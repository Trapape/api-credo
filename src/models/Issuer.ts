import { AskarModule } from "@credo-ts/askar";
import type { DidKey, W3cCredentialSubjectOptions } from "@credo-ts/core";
import {
  ClaimFormat,
  CredoError,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  parseDid,
  w3cDate,
} from "@credo-ts/core";
import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VcCredentialHolderDidBinding,
  OpenId4VcIssuerRecord,
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciCredentialSupportedWithId,
} from "@credo-ts/openid4vc";
import {
  OpenId4VcIssuerModule,
  OpenId4VciCredentialFormatProfile,
} from "@credo-ts/openid4vc";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";
import { Router } from "express";
import { BaseAgent } from "../types/BaseAgent";

export const universityDegreeCredential = {
  id: "UniversityDegreeCredential",
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  types: ["VerifiableCredential", "UniversityDegreeCredential"],
} satisfies OpenId4VciCredentialSupportedWithId;

export const openBadgeCredential = {
  id: "OpenBadgeCredential",
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  types: ["VerifiableCredential", "OpenBadgeCredential"],
} satisfies OpenId4VciCredentialSupportedWithId;

export const universityDegreeCredentialSdJwt = {
  id: "UniversityDegreeCredential-sdjwt",
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  vct: "UniversityDegreeCredential",
} satisfies OpenId4VciCredentialSupportedWithId;

export const tantanCredential = {
  id: "TantanCredential",
  format: OpenId4VciCredentialFormatProfile.JwtVcJson, // evaluar SdJwtVc si es necesario
  types: ["VerifiableCredential", "TantanCredential"],
} satisfies OpenId4VciCredentialSupportedWithId;

export const credentialsSupported = [
  universityDegreeCredential,
  openBadgeCredential,
  universityDegreeCredentialSdJwt,
  tantanCredential,
] satisfies OpenId4VciCredentialSupportedWithId[];

function getCredentialRequestToCredentialMapper({
  issuerDidKey,
}: {
  issuerDidKey: DidKey;
}): OpenId4VciCredentialRequestToCredentialMapper {
  return async ({
    holderBinding,
    credentialConfigurationIds,
    issuanceSession, //Asegúrate de que los campos relevantes como nombre, phone, etc., estén disponibles en los metadatos de emisión (issuanceSession.issuanceMetadata).
  }) => {
    const credentialConfigurationId = credentialConfigurationIds[0];

    // Recuperar datos adicionales de `issuanceMetadata` y convertirlas a cadenas de fecha si existen
    const name = issuanceSession.issuanceMetadata?.name;
    const degree = issuanceSession.issuanceMetadata?.degree;
    const issuanceDate = issuanceSession.issuanceMetadata?.issuanceDate
      ? w3cDate(
          new Date(
            issuanceSession.issuanceMetadata.issuanceDate as string
          ).toString()
        )
      : w3cDate(Date.now());
    const expirationDate = issuanceSession.issuanceMetadata?.expirationDate
      ? w3cDate(
          new Date(
            issuanceSession.issuanceMetadata.expirationDate as string
          ).toString()
        )
      : undefined;

    if (credentialConfigurationId === universityDegreeCredential.id) {
      assertDidBasedHolderBinding(holderBinding);
      return {
        credentialSupportedId: universityDegreeCredential.id,
        format: ClaimFormat.JwtVc,
        credential: new W3cCredential({
          type: universityDegreeCredential.types,
          issuer: new W3cIssuer({ id: issuerDidKey.did }),
          credentialSubject: {
            id: parseDid(holderBinding.didUrl).did,
            claims: {
              name: name || "Desconocido",
              degree: degree || "Desconocido",
            },
          } as W3cCredentialSubjectOptions, // Configuración ajustada aquí
          issuanceDate: issuanceDate,
          expirationDate: expirationDate,
        }),
        verificationMethod: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
      };
    }

    if (credentialConfigurationId === openBadgeCredential.id) {
      assertDidBasedHolderBinding(holderBinding);

      return {
        format: ClaimFormat.JwtVc,
        credentialSupportedId: openBadgeCredential.id,
        credential: new W3cCredential({
          type: openBadgeCredential.types,
          issuer: new W3cIssuer({
            id: issuerDidKey.did,
          }),
          credentialSubject: new W3cCredentialSubject({
            id: parseDid(holderBinding.didUrl).did,
          }),
          issuanceDate: w3cDate(Date.now()),
        }),
        verificationMethod: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
      };
    }

    if (credentialConfigurationId === universityDegreeCredentialSdJwt.id) {
      return {
        credentialSupportedId: universityDegreeCredentialSdJwt.id,
        format: ClaimFormat.SdJwtVc,
        payload: {
          vct: universityDegreeCredentialSdJwt.vct,
          university: "innsbruck",
          degree: "bachelor",
        },
        holder: holderBinding,
        issuer: {
          method: "did",
          didUrl: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
        },
        disclosureFrame: { _sd: ["university", "degree"] },
      };
    }

    if (credentialConfigurationId === tantanCredential.id) {
      assertDidBasedHolderBinding(holderBinding);

      return {
        credentialSupportedId: tantanCredential.id,
        format: ClaimFormat.JwtVc,
        credential: new W3cCredential({
          type: tantanCredential.types,
          issuer: new W3cIssuer({ id: issuerDidKey.did }),
          credentialSubject: {
            id: parseDid(holderBinding.didUrl).did,
            claims: {
              name: issuanceSession.issuanceMetadata?.nombre || "Desconocido",
              phone: issuanceSession.issuanceMetadata?.phone || "Sin teléfono",
              email: issuanceSession.issuanceMetadata?.email || "Sin email",
              institution:
                issuanceSession.issuanceMetadata?.institution_name || "Tantan",
              birth_date:
                issuanceSession.issuanceMetadata?.birth_date || "No disponible",
            },
          },
          issuanceDate: issuanceDate,
          expirationDate: expirationDate,
        }),
        verificationMethod: `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`,
      };
    }

    throw new Error("Invalid request");
  };
}

export class Issuer extends BaseAgent<{
  askar: AskarModule;
  openId4VcIssuer: OpenId4VcIssuerModule;
}> {
  public issuerRecord!: OpenId4VcIssuerRecord;

  public constructor(port: number, name: string) {
    const openId4VciRouter = Router();

    super({
      port,
      name,
      modules: {
        askar: new AskarModule({ ariesAskar }),
        openId4VcIssuer: new OpenId4VcIssuerModule({
          baseUrl: "http://localhost:2000/oid4vci",
          router: openId4VciRouter,
          endpoints: {
            credential: {
              credentialRequestToCredentialMapper: (...args) =>
                getCredentialRequestToCredentialMapper({
                  issuerDidKey: this.didKey,
                })(...args),
            },
          },
        }),
      },
    });

    this.app.use("/oid4vci", openId4VciRouter);
  }

  public static async build(): Promise<Issuer> {
    const port = process.env.ISSUER_PORT
      ? parseInt(process.env.ISSUER_PORT)
      : 0; // Usa ISSUER_PORT o 2000 por defecto
    const agentSecret = process.env.AGENT_SECRET || "default_secret_value";

    const issuer = new Issuer(
      port,
      "OpenId4VcIssuer " + Math.random().toString()
    );
    await issuer.initializeAgent(agentSecret);
    issuer.issuerRecord =
      await issuer.agent.modules.openId4VcIssuer.createIssuer({
        credentialsSupported,
      });

    return issuer;
  }

  /*public async createCredentialOffer(
    offeredCredentials: string[],
    options: {
      name?: string;
      degree?: string;
      issuanceDate?: string;
      expirationDate?: string;
    }
  ) {
    const { credentialOffer, issuanceSession } =
      await this.agent.modules.openId4VcIssuer.createCredentialOffer({
        issuerId: this.issuerRecord.issuerId,
        offeredCredentials,
        preAuthorizedCodeFlowConfig: { userPinRequired: false },
        issuanceMetadata: {
          name: options.name,
          degree: options.degree,
          issuanceDate: options.issuanceDate,
          expirationDate: options.expirationDate,
        },
      });

    return credentialOffer;
  }*/

  public async createCredentialOffer(
    offeredCredentials: string[],
    options: {
      name?: string;
      phone?: string;
      email?: string;
      institution_name?: string;
      birth_date?: string;
      issuanceDate?: string;
      expirationDate?: string;
    }
  ) {
    const { credentialOffer, issuanceSession } =
      await this.agent.modules.openId4VcIssuer.createCredentialOffer({
        issuerId: this.issuerRecord.issuerId,
        offeredCredentials,
        preAuthorizedCodeFlowConfig: { userPinRequired: false },
        issuanceMetadata: {
          name: options.name,
          phone: options.phone,
          email: options.email,
          institution_name: options.institution_name,
          birth_date: options.birth_date,
          issuanceDate: options.issuanceDate,
          expirationDate: options.expirationDate,
        },
      });

    return credentialOffer;
  }

  public async exit() {
    await this.agent.shutdown();
    process.exit(0);
  }

  public async restart() {
    await this.agent.shutdown();
  }
}

function assertDidBasedHolderBinding(
  holderBinding: OpenId4VcCredentialHolderBinding
): asserts holderBinding is OpenId4VcCredentialHolderDidBinding {
  if (holderBinding.method !== "did") {
    throw new CredoError(
      "Only did based holder bindings supported for this credential type"
    );
  }
}
