import {
  DifPresentationExchangeService,
  Mdoc,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
} from "@credo-ts/core";
import { OpenId4VcSiopResolvedAuthorizationRequest } from "@credo-ts/openid4vc";
import { Request, Response } from "express";
import MongoDB from "../config/db";
import { Holder } from "../models/Holder";
import { UnifiedAgent } from "../types/UnifiedAgent";

export class HolderController {
  private agent: UnifiedAgent;

  constructor(agent: UnifiedAgent) {
    this.agent = agent;
  }

  public async resolveCredentialOffer(req: Request, res: Response) {
    try {
      const { credentialOffer } = req.body;
      if (!credentialOffer) throw new Error("credentialOffer is required.");

      // Usar ConsolidatedAgent para resolver la oferta de credenciales
      const resolvedCredentialOffer =
        await this.agent.agent.modules.openId4VcHolder.resolveCredentialOffer(
          credentialOffer
        );

      res.json({
        resolvedCredentialOffer: resolvedCredentialOffer,
        credentialsToRequest: resolvedCredentialOffer.offeredCredentials.map(
          (credential: { id: any }) => credential.id
        ),
      });
    } catch (error: any) {
      if (!res.headersSent) {
        // Evita enviar múltiples respuestas
        res.status(500).json({
          error: error.message || "Failed to resolve credential offer.",
        });
      } else {
        console.error("Respuesta ya enviada:", error);
      }
    }
  }

  public async requestCredential(req: Request, res: Response) {
    try {
      const { resolvedCredentialOffer, credentialsToRequest } = req.body;

      // Validaciones iniciales
      if (!resolvedCredentialOffer) {
        throw new Error("resolvedCredentialOffer is required.");
      }
      if (!credentialsToRequest) {
        throw new Error("credentialsToRequest is required.");
      }

      // Validar presencia de campos obligatorios en la oferta de credenciales
      const metadata = resolvedCredentialOffer.metadata;
      if (!metadata || !metadata.token_endpoint) {
        throw new Error(
          "Missing token_endpoint in resolvedCredentialOffer.metadata"
        );
      }
      if (!metadata.credential_endpoint) {
        throw new Error(
          "Missing credential_endpoint in resolvedCredentialOffer.metadata"
        );
      }
      if (!metadata.credentialIssuerMetadata) {
        throw new Error(
          "Missing credentialIssuerMetadata in resolvedCredentialOffer.metadata"
        );
      }

      // Solicitar un token
      const tokenResponse =
        await this.agent.agent.modules.openId4VcHolder.requestToken({
          resolvedCredentialOffer,
        });

      if (!tokenResponse || !tokenResponse.accessToken) {
        throw new Error("Failed to obtain access token");
      }

      // Solicitar las credenciales
      const credentialResponse =
        await this.agent.agent.modules.openId4VcHolder.requestCredentials({
          resolvedCredentialOffer,
          ...tokenResponse,
          credentialsToRequest,
          credentialBindingResolver: async () => ({
            method: "did",
            didUrl: this.agent.verificationMethod?.id || "",
          }),
        });

      // Almacenar las credenciales obtenidas
      const storedCredentials = await Promise.all(
        credentialResponse.map(async (response: { credential: any }) => {
          const credential = response.credential;
          if (
            credential instanceof W3cJwtVerifiableCredential ||
            credential instanceof W3cJsonLdVerifiableCredential
          ) {
            return this.agent.agent.w3cCredentials.storeCredential({
              credential,
            });
          } else if (credential instanceof Mdoc) {
            return this.agent.agent.mdoc.store(credential);
          } else {
            return this.agent.agent.sdJwtVc.store(credential.compact);
          }
        })
      );

      // Formatear y devolver las credenciales almacenadas
      res.json({
        message: "Credential stored successfully",
        credentials: storedCredentials.map((credential) =>
          Holder.formatCredential(credential, this.agent)
        ),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to request credential.",
      });
    }
  }

  public async resolveProofRequest(req: Request, res: Response) {
    try {
      const { proofRequestUri } = req.body;
      if (!proofRequestUri) throw new Error("proofRequestUri is required");

      // Usar ConsolidatedAgent para resolver una solicitud de prueba
      const resolvedProofRequest =
        await this.agent.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(
          proofRequestUri
        );

      if (!resolvedProofRequest)
        throw new Error("No valid proof request resolved.");

      const presentationDefinition =
        resolvedProofRequest.presentationExchange?.definition;
      const credentialsReady =
        resolvedProofRequest.presentationExchange?.credentialsForRequest
          ?.areRequirementsSatisfied;

      if (!credentialsReady) {
        throw new Error(
          "No credentials available that satisfy the proof request."
        );
      }

      const stateId = `resolved:${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`;

      const db = MongoDB.getDb();
      const collection = db.collection("resolvedRequests");

      await collection.insertOne({
        id: stateId,
        status: "pending",
        createdAt: new Date(),
        proofRequestUri,
        stateId,
      });

      res.json({
        message: "Proof request resolved",
        presentationPurpose: presentationDefinition?.purpose,
        credentialsReady: credentialsReady || false,
        stateId,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to resolve proof request.",
      });
    }
  }

  public async acceptPresentationRequest(req: Request, res: Response) {
    try {
      const { stateId } = req.body;

      if (!stateId) throw new Error("stateId is required.");

      const db = MongoDB.getDb();
      const collection = db.collection("resolvedRequests");

      const storedRequest = await collection.findOneAndUpdate(
        { id: stateId, status: "pending" },
        { $set: { status: "used" } },
        { returnDocument: "after" }
      );

      if (!storedRequest)
        throw new Error("Proof request not found, expired, or already used.");

      const resolvedPresentationRequest: OpenId4VcSiopResolvedAuthorizationRequest =
        await this.agent.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(
          storedRequest.proofRequestUri
        );

      if (!resolvedPresentationRequest.presentationExchange) {
        throw new Error(
          "Missing presentation exchange on resolved authorization request."
        );
      }

      // Resolver el servicio de intercambio de presentaciones
      const presentationExchangeService =
        this.agent.agent.dependencyManager.resolve(
          DifPresentationExchangeService
        );

      // Seleccionar credenciales para la solicitud de presentación
      const credentials =
        presentationExchangeService.selectCredentialsForRequest(
          resolvedPresentationRequest.presentationExchange.credentialsForRequest
        );

      // Aceptar la solicitud de presentación
      const acceptPresentationRequestResponse =
        await this.agent.agent.modules.openId4VcHolder.acceptSiopAuthorizationRequest(
          {
            authorizationRequest:
              resolvedPresentationRequest.authorizationRequest,
            presentationExchange: {
              credentials,
            },
          }
        );

      // Verificar el estado de la respuesta y devolver el resultado
      if (
        acceptPresentationRequestResponse.serverResponse.status >= 200 &&
        acceptPresentationRequestResponse.serverResponse.status < 300
      ) {
        res.json({
          message: "Presentation accepted successfully",
          acceptPresentationRequestResponse,
        });
      } else {
        res.status(400).json({
          message: "Received error status code",
          acceptPresentationRequestResponse,
        });
      }
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to accept presentation request.",
      });
    }
  }
}
