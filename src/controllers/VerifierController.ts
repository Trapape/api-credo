import { Request, Response } from "express";
import { presentationDefinitions } from "../models/Verifier";
import { UnifiedAgent } from "../types/UnifiedAgent";

export class VerifierController {
  private agent: UnifiedAgent;

  constructor(agent: UnifiedAgent) {
    this.agent = agent;
  }

  public async createProofRequest(req: Request, res: Response) {
    try {
      const { credentialType } = req.body;
      let presentationDefinition;
      if (credentialType) {
        presentationDefinition = presentationDefinitions.find(
          (def) => def.id === credentialType
        );
        if (!presentationDefinition)
          throw new Error(
            `No presentation definition found for credential type: ${credentialType}`
          );
      } else {
        presentationDefinition = presentationDefinitions.find(
          (def) => def.id === "genericCredential"
        );
        if (!presentationDefinition)
          throw new Error(
            `No presentation definition found for generic credential`
          );
      }

      // Crear la solicitud de prueba utilizando el agente consolidado
      const proofRequestUri =
        await this.agent.agent.modules.openId4VcVerifier.createAuthorizationRequest(
          {
            requestSigner: {
              method: "did",
              didUrl: this.agent.verificationMethod?.id || "",
            },
            verifierId: this.agent.verifierRecord.verifierId,
            presentationExchange: {
              definition: presentationDefinition,
            },
          }
        );

      res.json({ proofRequestUri });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to create proof request.",
      });
    }
  }
}
