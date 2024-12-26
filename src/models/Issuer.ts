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
  OpenId4VciCredentialRequestToCredentialMapper,
  OpenId4VciCredentialSupportedWithId,
} from "@credo-ts/openid4vc";
import { OpenId4VciCredentialFormatProfile } from "@credo-ts/openid4vc";

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
  //universityDegreeCredential,
  //openBadgeCredential,
  //universityDegreeCredentialSdJwt,
  tantanCredential,
] satisfies OpenId4VciCredentialSupportedWithId[];

export const display = [
  {
    name: "Tantan",
    description: "Issuer of Tantan Credentials",
    text_color: "#FFFFFF",
    background_color: "#000000",
    logo: {
      url: "https://api.tantan.solutions/static/credential/tantan.png",
      alt_text: "Tantan Logo",
    },
  },
];

export class Issuer {
  static getCredentialRequestToCredentialMapper({
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
                name: issuanceSession.issuanceMetadata?.name || "Desconocido",
                phone:
                  issuanceSession.issuanceMetadata?.phone || "Sin teléfono",
                email: issuanceSession.issuanceMetadata?.email || "Sin email",
                institution:
                  issuanceSession.issuanceMetadata?.institution_name ||
                  "Tantan",
                birth_date:
                  issuanceSession.issuanceMetadata?.birth_date ||
                  "No disponible",
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
