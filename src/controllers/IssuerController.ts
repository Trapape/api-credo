import { Request, Response } from "express";
import {
  credentialsSupported,
  Issuer,
  universityDegreeCredential,
} from "../models/Issuer";

let issuerInstance: Issuer | null = null;

export async function getIssuerInstance() {
  if (!issuerInstance) {
    issuerInstance = await Issuer.build();
  }
  return issuerInstance;
}

export async function createCredentialOffer(req: Request, res: Response) {
  try {
    const issuer = await getIssuerInstance();

    const {
      credentialType = universityDegreeCredential.id,
      issuanceDate,
      expirationDate,
      name,
      degree,
    } = req.body;

    /*const isValidDate = (date: any) => !isNaN(new Date(date).getTime());

    if (issuanceDate && !isValidDate(issuanceDate)) {
      throw new Error("The provided issuanceDate is not a valid date.");
    }

    if (expirationDate && !isValidDate(expirationDate)) {
      throw new Error("The provided expirationDate is not a valid date.");
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("The provided name is invalid.");
    }

    if (!degree || typeof degree !== "string" || degree.trim() === "") {
      throw new Error("The provided degree is invalid.");
    }*/

    const offeredCredential = credentialsSupported.find(
      (credential) => credential.id === credentialType
    );
    if (!offeredCredential) {
      throw new Error(
        `No credential of type ${credentialType} found, that can be offered.`
      );
    }

    const credentialOffer = await issuer.createCredentialOffer(
      [offeredCredential.id],
      {
        name,
        degree,
        issuanceDate,
        expirationDate,
      }
    );
    res.json({ credentialOffer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
