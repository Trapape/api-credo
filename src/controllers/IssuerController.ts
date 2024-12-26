import {
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuanceSessionStateChangedEvent,
  OpenId4VcIssuerEvents,
} from "@credo-ts/openid4vc";
import { Request, Response } from "express";
import { credentialsSupported } from "../models/Issuer";
import { UnifiedAgent } from "../types/UnifiedAgent";

export class IssuerController {
  private agent: UnifiedAgent;

  constructor(agent: UnifiedAgent) {
    console.log("IssuerController inicializado");
    this.agent = agent;
  }

  public async createProofRequest(req: Request, res: Response) {
    try {
      const { credentialType, metadata } = req.body;

      const offeredCredential = credentialsSupported.find(
        (credential) => credential.id === credentialType
      );
      if (!offeredCredential) {
        throw new Error(
          `No credential of type ${credentialType} found, that can be offered.`
        );
      }

      let credentialOffer: any;
      let issuanceSession: any;

      // Delega al método específico según el tipo de credencial
      switch (credentialType) {
        case "TantanCredential":
          ({ credentialOffer, issuanceSession } =
            await this.agent.agent.modules.openId4VcIssuer.createCredentialOffer(
              {
                issuerId: this.agent.issuerRecord.issuerId,
                offeredCredentials: [credentialType],
                preAuthorizedCodeFlowConfig: { userPinRequired: false },
                issuanceMetadata: {
                  name: metadata.name,
                  phone: metadata.phone,
                  email: metadata.email,
                  institution_name: metadata.institution_name,
                  birth_date: metadata.birth_date,
                  issuanceDate: metadata.issuanceDate,
                  expirationDate: metadata.expirationDate,
                },
              }
            ));
          break;
        case "UniversityDegreeCredential":
          ({ credentialOffer, issuanceSession } =
            await this.agent.agent.modules.openId4VcIssuer.createCredentialOffer(
              {
                issuerId: this.agent.issuerRecord.issuerId,
                offeredCredentials: [credentialType],
                preAuthorizedCodeFlowConfig: { userPinRequired: false },
                issuanceMetadata: {
                  name: metadata.name,
                  degree: metadata.degree,
                  institution_name: metadata.institution_name,
                  issuanceDate: metadata.issuanceDate,
                  expirationDate: metadata.expirationDate,
                },
              }
            ));
          break;
        default:
          throw new Error(`Unsupported credential type: ${credentialType}`);
      }

      this.agent.agent.events.on<OpenId4VcIssuanceSessionStateChangedEvent>(
        OpenId4VcIssuerEvents.IssuanceSessionStateChanged,
        (event) => {
          // Validar que el evento corresponde a la sesión de emisión actual
          if (event.payload.issuanceSession.id === issuanceSession.id) {
            console.log(
              "Issuance session state changed to ",
              event.payload.issuanceSession.id
            );

            // Reaccionar al estado de la sesión
            switch (event.payload.issuanceSession.state) {
              case OpenId4VcIssuanceSessionState.Completed:
                console.log("Emisión completada con éxito.");
                break;
              case OpenId4VcIssuanceSessionState.Error:
                console.error("La emisión falló.");
                break;
              case OpenId4VcIssuanceSessionState.OfferCreated:
                console.log("La oferta fue creada.");
                break;
              case OpenId4VcIssuanceSessionState.OfferUriRetrieved:
                console.log("El URI de la oferta fue recuperado.");
                break;
              case OpenId4VcIssuanceSessionState.AccessTokenRequested:
                console.log("Se solicitó un token de acceso.");
                break;
              case OpenId4VcIssuanceSessionState.AccessTokenCreated:
                console.log("Se creó un token de acceso.");
                break;
              case OpenId4VcIssuanceSessionState.CredentialRequestReceived:
                console.log("Se recibió una solicitud de credenciales.");
                break;
              case OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued:
                console.log("Las credenciales fueron parcialmente emitidas.");
                break;
              default:
                console.warn(
                  "Estado desconocido:",
                  event.payload.issuanceSession.state
                );
            }
          }
        }
      );

      res.json({ credentialOffer, issuanceSession });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({
        error:
          error.message || "An error occurred while processing the request.",
      });
    }
  }
}
