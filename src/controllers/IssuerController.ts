import { Request, Response } from "express";
import {
  credentialsSupported,
  Issuer,
  tantanCredential,
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
      credentialType = tantanCredential.id, // Cambiar a TantanCredential por defecto si es necesario
      issuanceDate,
      expirationDate,
      name,
      phone,
      email,
      institution_name,
      birth_date,
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

    // Validaciones adicionales
    /*if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("The provided name is invalid.");
    }
    if (!phone || typeof phone !== "string" || phone.trim() === "") {
      throw new Error("The provided phone is invalid.");
    }
    if (!email || typeof email !== "string" || email.trim() === "") {
      throw new Error("The provided email is invalid.");
    }
    if (!institution_name || typeof institution_name !== "string") {
      throw new Error("The provided institution_name is invalid.");
    }
    if (!birth_date || typeof birth_date !== "string") {
      throw new Error("The provided birth_date is invalid.");
    }*/

    const credentialOffer = await issuer.createCredentialOffer(
      [offeredCredential.id],
      {
        name,
        phone,
        email,
        institution_name,
        birth_date,
        issuanceDate,
        expirationDate,
      }
    );
    res.json({ credentialOffer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
