import { Mdoc } from "@credo-ts/core";

export class Holder {
  static formatCredential(credential: any, agent: any) {
    if (credential.type === "W3cCredentialRecord") {
      return {
        type: "W3cCredentialRecord",
        claimFormat: credential.credential.claimFormat,
        jsonCredential: credential.credential.jsonCredential,
      };
    } else if (credential.type === "MdocRecord") {
      return {
        type: "MdocRecord",
        namespaces: credential.base64Url
          ? Mdoc.fromBase64Url(credential.base64Url).issuerSignedNamespaces
          : {},
      };
    } else if (credential.type === "SdJwtVcRecord") {
      return {
        type: "SdJwtVcRecord",
        claims: credential.compactSdJwtVc
          ? agent.sdJwtVc.fromCompact(credential.compactSdJwtVc).prettyClaims
          : {},
      };
    } else if (
      credential.type === "W3cJwtVerifiableCredential" ||
      credential.type === "W3cJsonLdVerifiableCredential"
    ) {
      return {
        type: credential.type,
        credential: credential.jsonCredential || credential.compact || {},
      };
    } else {
      return credential;
    }
  }
}
