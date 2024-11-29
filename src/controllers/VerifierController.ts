import { Request, Response } from "express";
import { Verifier, presentationDefinitions } from "../models/Verifier";

let verifierInstance: Verifier | null = null;

export async function getVerifierInstance() {
  if (!verifierInstance) {
    verifierInstance = await Verifier.build();
  }
  return verifierInstance;
}

export async function createProofRequest(req: Request, res: Response) {
  try {
    const { credentialType = "UniversityDegreeCredential" } = req.body;

    const presentationDefinition = presentationDefinitions.find(
      (def) => def.id === credentialType
    );
    if (!presentationDefinition) {
      throw new Error(
        `No presentation definition found for credential type: ${credentialType}`
      );
    }

    const verifier = await getVerifierInstance();
    const proofRequestUri = await verifier.createProofRequest(
      presentationDefinition
    );

    res.json({ proofRequestUri });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Endpoint para procesar credencial MDL a partir de QR
export async function decodeMDLQR(req: Request, res: Response) {
  try {
    const { qrCode } = req.body;
    const verifier = await getVerifierInstance();
    const decodedData = await verifier.decodeAndValidateQRCode(qrCode);
    res.status(200).json({
      message: "QR decodificado exitosamente",
      data: decodedData,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}
