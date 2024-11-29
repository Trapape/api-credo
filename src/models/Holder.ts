import type {
  OpenId4VciResolvedCredentialOffer,
  OpenId4VcSiopResolvedAuthorizationRequest,
} from "@credo-ts/openid4vc";

import { AskarModule } from "@credo-ts/askar";
import {
  DifPresentationExchangeService,
  Mdoc,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
} from "@credo-ts/core";
import { OpenId4VcHolderModule } from "@credo-ts/openid4vc";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";
import { BaseAgent } from "../types/BaseAgent";

import "dotenv/config";

function getOpenIdHolderModules() {
  return {
    askar: new AskarModule({ ariesAskar }),
    openId4VcHolder: new OpenId4VcHolderModule(),
  } as const;
}

export class Holder extends BaseAgent<
  ReturnType<typeof getOpenIdHolderModules>
> {
  public constructor(port: number, name: string) {
    super({ port, name, modules: getOpenIdHolderModules() });
  }

  public static async build(): Promise<Holder> {
    const port = process.env.HOLDER_PORT
      ? parseInt(process.env.HOLDER_PORT)
      : 0;
    const agentSecret = process.env.AGENT_SECRET || "default_secret_value";

    const holder = new Holder(
      port,
      "OpenId4VcHolder " + Math.random().toString()
    );
    await holder.initializeAgent(agentSecret);

    return holder;
  }

  public async resolveCredentialOffer(credentialOffer: string) {
    return await this.agent.modules.openId4VcHolder.resolveCredentialOffer(
      credentialOffer
    );
  }

  public async requestAndStoreCredentials(
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer,
    credentialsToRequest: string[]
  ) {
    // Validar presencia de los campos necesarios
    if (
      !resolvedCredentialOffer.metadata ||
      !resolvedCredentialOffer.metadata.token_endpoint
    ) {
      throw new Error(
        "Missing token_endpoint in resolvedCredentialOffer.metadata"
      );
    }
    if (!resolvedCredentialOffer.metadata.credential_endpoint) {
      throw new Error(
        "Missing credential_endpoint in resolvedCredentialOffer.metadata"
      );
    }
    if (!resolvedCredentialOffer.metadata.credentialIssuerMetadata) {
      throw new Error(
        "Missing credentialIssuerMetadata in resolvedCredentialOffer.metadata"
      );
    }

    /*if (resolvedCredentialOffer.metadata?.credential_configuration_id === tantanCredential.id) {
      console.log("Handling TantanCredential...");
      // Si necesitas lógica específica, añádela aquí
    }*/

    // Continuar con el flujo de solicitud
    const tokenResponse = await this.agent.modules.openId4VcHolder.requestToken(
      {
        resolvedCredentialOffer,
      }
    );

    if (!tokenResponse || !tokenResponse.accessToken) {
      throw new Error("Failed to obtain access token");
    }

    const credentialResponse =
      await this.agent.modules.openId4VcHolder.requestCredentials({
        resolvedCredentialOffer,
        ...tokenResponse,
        credentialsToRequest,
        credentialBindingResolver: async () => ({
          method: "did",
          didUrl: this.verificationMethod?.id || "",
        }),
      });

    const storedCredentials = await Promise.all(
      credentialResponse.map((response) => {
        const credential = response.credential;
        if (
          credential instanceof W3cJwtVerifiableCredential ||
          credential instanceof W3cJsonLdVerifiableCredential
        ) {
          return this.agent.w3cCredentials.storeCredential({ credential });
        } else if (credential instanceof Mdoc) {
          return this.agent.mdoc.store(credential);
        } else {
          return this.agent.sdJwtVc.store(credential.compact);
        }
      })
    );

    return storedCredentials;
  }

  public async resolveProofRequest(proofRequest: string) {
    const resolvedProofRequest =
      await this.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(
        proofRequest
      );

    return resolvedProofRequest;
  }

  public async acceptPresentationRequest(
    resolvedPresentationRequest: OpenId4VcSiopResolvedAuthorizationRequest
  ) {
    const presentationExchangeService = this.agent.dependencyManager.resolve(
      DifPresentationExchangeService
    );

    if (!resolvedPresentationRequest.presentationExchange) {
      throw new Error(
        "Missing presentation exchange on resolved authorization request"
      );
    }

    const submissionResult =
      await this.agent.modules.openId4VcHolder.acceptSiopAuthorizationRequest({
        authorizationRequest: resolvedPresentationRequest.authorizationRequest,
        presentationExchange: {
          credentials: presentationExchangeService.selectCredentialsForRequest(
            resolvedPresentationRequest.presentationExchange
              .credentialsForRequest
          ),
        },
      });

    //return submissionResult.serverResponse.body || submissionResult.serverResponse;
    return submissionResult;
  }

  public async exit() {
    await this.agent.shutdown();
    process.exit(0);
  }

  public async restart() {
    await this.agent.shutdown();
  }
}
