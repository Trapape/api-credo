import { AskarModule } from "@credo-ts/askar";
import { type DifPresentationExchangeDefinitionV2 } from "@credo-ts/core";
import type { OpenId4VcVerifierRecord } from "@credo-ts/openid4vc";
import { OpenId4VcVerifierModule } from "@credo-ts/openid4vc";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";
import * as cbor from "cbor"; // Usa CBOR si la credencial MDL está en ese formato
import { Router } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { default as jwkToBuffer, default as jwkToPem } from "jwk-to-pem";
import { BaseAgent } from "../types/BaseAgent";
const jose = require("jose");

const jwk: jwkToBuffer.EC = {
  //kid: "8b12ea18935db1c596162df68f5e2c60ec3d26e0f5aa843da224df609b581471",
  kty: "EC",
  x: "RakAYMzQGwDt6iXcpFPVWUoo9Ypcd1fa2KZ2ANaAT_E",
  y: "FF0YkR9yH_UM9IjcJR1_KwoISLHS8yJHXEcbvp9yAdg",
  crv: "P-256",
};

const universityDegreePresentationDefinition = {
  id: "UniversityDegreeCredential",
  purpose:
    "Present your UniversityDegreeCredential to verify your education level.",
  input_descriptors: [
    {
      id: "UniversityDegreeCredentialDescriptor",
      constraints: {
        fields: [
          {
            path: ["$.vc.type.*", "$.vct", "$.type"],
            filter: {
              type: "string",
              pattern: "UniversityDegree",
            },
          },
        ],
      },
    },
  ],
};

const openBadgeCredentialPresentationDefinition = {
  id: "OpenBadgeCredential",
  purpose: "Provide proof of employment to confirm your employment status.",
  input_descriptors: [
    {
      id: "OpenBadgeCredentialDescriptor",
      constraints: {
        fields: [
          {
            path: ["$.vc.type.*", "$.vct", "$.type"],
            filter: {
              type: "string",
              pattern: "OpenBadgeCredential",
            },
          },
        ],
      },
    },
  ],
};

const tantanPresentationDefinition = {
  id: "TantanCredential",
  purpose: "Present your Tantan Credential to verify your identity.",
  input_descriptors: [
    {
      id: "TantanCredentialDescriptor",
      constraints: {
        fields: [
          {
            path: ["$.vc.type.*", "$.type"],
            filter: {
              type: "string",
              pattern: "TantanCredential",
            },
          },
        ],
      },
    },
  ],
};

export const presentationDefinitions = [
  universityDegreePresentationDefinition,
  openBadgeCredentialPresentationDefinition,
  tantanPresentationDefinition,
];

export class Verifier extends BaseAgent<{
  askar: AskarModule;
  openId4VcVerifier: OpenId4VcVerifierModule;
}> {
  public verifierRecord!: OpenId4VcVerifierRecord;

  public constructor(port: number, name: string) {
    const openId4VcSiopRouter = Router();

    super({
      port,
      name,
      modules: {
        askar: new AskarModule({ ariesAskar }),
        openId4VcVerifier: new OpenId4VcVerifierModule({
          baseUrl: "http://localhost:4000/siop",
          router: openId4VcSiopRouter,
        }),
      },
    });

    this.app.use("/siop", openId4VcSiopRouter);
  }

  public static async build(): Promise<Verifier> {
    const port = process.env.VERIFIER_PORT
      ? parseInt(process.env.VERIFIER_PORT)
      : 0; // Usa ISSUER_PORT o 2000 por defecto
    const agentSecret = process.env.AGENT_SECRET || "default_secret_value";

    const verifier = new Verifier(
      port,
      "OpenId4VcVerifier " + Math.random().toString()
    );
    await verifier.initializeAgent(agentSecret);
    verifier.verifierRecord =
      await verifier.agent.modules.openId4VcVerifier.createVerifier();

    return verifier;
  }

  public async createProofRequest(
    presentationDefinition: DifPresentationExchangeDefinitionV2
  ) {
    const { authorizationRequest } =
      await this.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: {
          method: "did",
          didUrl: this.verificationMethod.id,
        },
        verifierId: this.verifierRecord.verifierId,
        presentationExchange: {
          definition: presentationDefinition,
        },
      });

    return authorizationRequest;
  }

  public async createMDLAuthorizationRequest() {
    const presentationDefinition = {
      id: "Iso18013DriversLicenseCredential",
      purpose: "Verificación de licencia de conducir",
      input_descriptors: [
        {
          id: "DriversLicenseDescriptor",
          constraints: {
            fields: [
              {
                path: ["$.vc.type.*", "$.vc.type"],
                filter: {
                  type: "string",
                  pattern: "Iso18013DriversLicenseCredential",
                },
              },
            ],
          },
        },
      ],
    };

    const { authorizationRequest } =
      await this.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: { method: "did", didUrl: this.verificationMethod.id },
        verifierId: this.verifierRecord.verifierId,
        presentationExchange: { definition: presentationDefinition },
      });

    return authorizationRequest;
  }

  public async decodeAndValidateQRCode(base64Data: string): Promise<any> {
    const results: Record<string, any>[] = [
      { jwtData: { error: [], value: "" } },
      { jwtDataKey: { error: [], value: "" } },
      { cborData: { error: [], value: "" } },
    ];

    // Eliminar el prefijo `mdoc:` si está presente
    //base64Data = base64Data.replace(/^VP1-|^mdoc:/, "");

    // Verificar si el contenido tiene un formato base64 válido
    /*if (!isBase64String(base64Data)) {
      results.push({
        isBase64String: {
          error: "El contenido no es un string base64 válido",
          value: base64Data,
        },
      });
    }*/

    // Intentar decodificar como JWT
    try {
      const jwtData = jwt.decode(base64Data);
      results[0].jwtData.value = jwtData;
    } catch (jwtError: any) {
      results[0].jwtData.error.push(jwtError.message);
    }

    // Intentar validar el JWT con la clave
    // Convertir JWK a PEM
    try {
      const publicKey = jwkToPem(jwk);
      const verifiedJwt = await verifyJWT(base64Data, publicKey);
      results[1].jwtDataKey.value = verifiedJwt.value;
      results[1].jwtDataKey.error.push(verifiedJwt.error);
    } catch (error: any) {
      results[1].jwtDataKey.error.push(error.message);
    }

    // Intentar decodificar como CBOR
    try {
      const buffer = Buffer.from(base64Data, "base64");
      const cborData = await cbor.decodeFirst(buffer);
      const processedData = processDecodedData(cborData);
      results[2].cborData.value =
        processedData instanceof Map
          ? Object.fromEntries(processedData)
          : processedData;
    } catch (cborError: any) {
      results[2].cborData.error.push(cborError.message);
    }

    const publicKeyJwk = {
      kty: "EC",
      crv: "P-256",
      x: "<replace_with_x_component>",
      y: "<replace_with_y_component>",
    };

    /*try {
      // Decodificar el CBOR principal
      const obj = await cbor.decodeFirst(Buffer.from(base64Data, "base64"));
      console.log("Datos decodificados del QR:", obj);

      // Valor del segundo elemento decodificado
      const taggedValue = obj.get(1)[1];

      // Decodificar el buffer dentro del valor etiquetado
      const decoded = await cbor.decodeFirst(taggedValue.value);

      if (decoded instanceof Map) {
        console.log("Valor decodificado dentro del valor etiquetado:", decoded);
        const xComponent = decoded.get(-2).toString("base64");
        const yComponent = decoded.get(-3).toString("base64");

        // Reemplazar los componentes X e Y en la clave pública
        publicKeyJwk.x = xComponent;
        publicKeyJwk.y = yComponent;

        console.log("Clave pública JWK:", publicKeyJwk);
      }
    } catch (error) {
      console.error("Error al decodificar los datos del QR:", error);
    }*/

    /*try {
      // Intentar decodificar la cadena base64 como un JWT
      try {
        const jwt = base64Data;
        const decodedJwt = decodeJwt(jwt);
        console.log("Datos decodificados del JWT:", decodedJwt);
        return;
      } catch (jwtError) {
        console.error("No se pudo decodificar como JWT:", jwtError);
      }

      // Si no es un JWT, intentar decodificar como CBOR
      try {
        const buffer = Buffer.from(base64Data, "base64");
        const decodedCbor = await cbor.decodeFirst(buffer);
        console.log("Datos decodificados del CBOR:", decodedCbor);
      } catch (cborError) {
        console.error("No se pudo decodificar como CBOR:", cborError);
      }
    } catch (error) {
      console.error("Error al decodificar los datos del QR VP1:", error);
    }*/
    try {
      const decodedJwt = jose.decodeJwt(base64Data);
      console.log("Datos decodificados del JWT:", decodedJwt);
    } catch (jwtError) {
      console.error("No se pudo decodificar como JWT:", jwtError);
    }

    try {
      const buffer = Buffer.from(base64Data, "base64");
      console.log("Datos decodificados del Base64:", buffer);

      // Imprimir los primeros 16 bytes en hexadecimal y en valores numéricos
      const firstBytesHex = buffer.slice(0, 16).toString("hex");
      const firstBytesArray = Array.from(buffer.slice(0, 16));

      console.log("Primeros 16 bytes en hexadecimal:", firstBytesHex);
      console.log("Primeros 16 bytes en valores numéricos:", firstBytesArray);
    } catch (base64Error) {
      console.error("No se pudo decodificar como Base64:", base64Error);
    }

    return results;
  }

  public async exit() {
    await this.agent.shutdown();
    process.exit(0);
  }

  public async restart() {
    await this.agent.shutdown();
  }
}

function isBase64String(base64Data: string): boolean {
  const base64Regex =
    /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
  return base64Regex.test(base64Data);
}

function processDecodedData(data: any): any {
  if (Buffer.isBuffer(data)) {
    // Convertir Buffer a base64 para una representación legible
    return data.toString("base64");
  } else if (data instanceof Map) {
    // Convertir Map en un objeto estándar y procesar recursivamente
    return Object.fromEntries(
      Array.from(data.entries()).map(([key, value]) => [
        key,
        processDecodedData(value),
      ])
    );
  } else if (Array.isArray(data)) {
    // Procesar cada elemento del array
    return data.map((item) => processDecodedData(item));
  } else if (typeof data === "object" && data !== null) {
    // Procesar cada propiedad del objeto
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        processDecodedData(value),
      ])
    );
  }
  return data;
}

function validateCredentialFields(credential: any): boolean {
  // Ejemplo de validación de tipo de credencial
  /*if (credential.type !== "Iso18013DriversLicenseCredential") {
    return false;
  }
  // Validación de expiración o cualquier otra configuración
  if (credential.exp && credential.exp < Date.now() / 1000) {
    return false;
  }*/
  return true;
}

async function verifyJWT(
  base64Data: string,
  publicKey: string
): Promise<{ error?: string; value?: JwtPayload | null }> {
  try {
    const verified = jwt.verify(base64Data, publicKey, {
      algorithms: ["ES256"],
    }) as JwtPayload;
    return { value: verified, error: "" };
  } catch (error: any) {
    return {
      value: null,
      error: error.message,
    };
  }
}
