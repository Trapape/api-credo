import { Mdoc } from "@credo-ts/core";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import MongoDB from "../config/db";
import { Holder } from "../models/Holder";
import { greenText } from "../utils/OutputClass";

let holderInstance: Holder | null = null;

export async function getHolderInstance() {
  if (!holderInstance) {
    holderInstance = await Holder.build();
  }
  return holderInstance;
}

export async function resolveCredentialOffer(req: Request, res: Response) {
  try {
    const { credentialOffer } = req.body;
    if (!credentialOffer) throw new Error("credentialOffer is required.");

    const holder = await getHolderInstance();
    const resolvedCredentialOffer = await holder.resolveCredentialOffer(
      credentialOffer
    );

    res.json({
      resolvedCredentialOffer: resolvedCredentialOffer,
      credentialsToRequest: resolvedCredentialOffer.offeredCredentials.map(
        (credential) => credential.id
      ),
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to resolve credential offer." });
  }
}

export async function requestCredential(req: Request, res: Response) {
  try {
    const { resolvedCredentialOffer, credentialsToRequest } = req.body;

    if (!resolvedCredentialOffer)
      throw new Error("resolvedCredentialOffer is required.");
    if (!credentialsToRequest)
      throw new Error("credentialsToRequest is required.");

    const holder = await getHolderInstance();

    const credentials = await holder.requestAndStoreCredentials(
      resolvedCredentialOffer,
      credentialsToRequest
    );

    res.json({
      message: "Credential stored successfully",
      credentials: credentials.map((credential: any) =>
        formatCredential(credential)
      ),
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to request credential." });
  }
}

export async function resolveProofRequest(req: Request, res: Response) {
  try {
    const { proofRequestUri } = req.body;
    if (!proofRequestUri) throw new Error("proofRequestUri is required");

    const holder = await getHolderInstance();
    const resolvedPresentationRequest = await holder.resolveProofRequest(
      proofRequestUri
    );

    if (!resolvedPresentationRequest)
      throw new Error("No valid proof request resolved.");

    const presentationDefinition =
      resolvedPresentationRequest.presentationExchange?.definition;
    const credentialsReady =
      resolvedPresentationRequest.presentationExchange?.credentialsForRequest
        ?.areRequirementsSatisfied;

    if (!credentialsReady)
      throw new Error(
        "No credentials available that satisfy the proof request."
      );

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
    });

    res.json({
      message: "Proof request resolved",
      presentationPurpose: presentationDefinition?.purpose,
      credentialsReady: true,
      stateId,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to resolve proof request." });
  }
}

export async function acceptPresentationRequest(req: Request, res: Response) {
  try {
    const { stateId } = req.body;

    if (!stateId) throw new Error("stateId is required");

    const db = MongoDB.getDb();
    const collection = db.collection("resolvedRequests");

    const storedRequest = await collection.findOneAndUpdate(
      { id: stateId, status: "pending" },
      { $set: { status: "used" } },
      { returnDocument: "after" }
    );

    console.log(greenText(JSON.stringify(storedRequest)));

    if (!storedRequest)
      throw new Error("Proof request not found, expired, or already used.");

    const holder = await getHolderInstance();
    const resolvedPresentationRequest = await holder.resolveProofRequest(
      storedRequest.proofRequestUri
    );
    const acceptPresentationRequestResponse =
      await holder.acceptPresentationRequest(resolvedPresentationRequest);

    if (
      acceptPresentationRequestResponse.serverResponse.status >= 200 &&
      acceptPresentationRequestResponse.serverResponse.status < 300
    ) {
      res.json({
        message: "Presentation accepted successfully",
        acceptPresentationRequestResponse,
      });
    } else {
      res.json({
        message: "received error status code",
        acceptPresentationRequestResponse,
      });
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error || "Failed to accept presentation request." });
  }
}

function formatCredential(credential: any) {
  if (credential.type === "W3cCredentialRecord") {
    return {
      type: "W3cCredentialRecord",
      claimFormat: credential.credential.claimFormat,
      jsonCredential: credential.credential.jsonCredential,
    };
  } else if (credential.type === "MdocRecord") {
    const namespaces = Mdoc.fromBase64Url(
      credential.base64Url
    ).issuerSignedNamespaces;
    return {
      type: "MdocRecord",
      namespaces: namespaces,
    };
  } else if (credential.type === "SdJwtVcRecord") {
    const prettyClaims = credential.agent.sdJwtVc.fromCompact(
      credential.compactSdJwtVc
    ).prettyClaims;
    return {
      type: "SdJwtVcRecord",
      claims: prettyClaims,
    };
  } else if (
    credential.type === "W3cJwtVerifiableCredential" ||
    credential.type === "W3cJsonLdVerifiableCredential"
  ) {
    const decodedCredential = jwt.decode(
      credential.jsonCredential || credential.compact,
      { json: true }
    );
    return {
      type: credential.type,
      credential:
        decodedCredential || credential.jsonCredential || credential.compact,
    };
  } else {
    return credential;
  }
}
