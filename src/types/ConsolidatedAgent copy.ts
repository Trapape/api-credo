import { AskarModule } from "@credo-ts/askar";
import {
  OpenId4VcHolderModule,
  OpenId4VcIssuerModule,
  OpenId4VcVerifierModule,
} from "@credo-ts/openid4vc";
import { Application, Router } from "express";
import { credentialsSupported, Issuer } from "../models/Issuer";
import { BaseAgent } from "./BaseAgent";

export class ConsolidatedAgent extends BaseAgent<{
  askar: AskarModule;
  openId4VcHolder: OpenId4VcHolderModule;
  openId4VcIssuer: OpenId4VcIssuerModule;
  openId4VcVerifier: OpenId4VcVerifierModule;
}> {
  public holderRecord: any;
  public issuerRecord: any;
  public verifierRecord: any;

  constructor(app: Application, baseUrl: string, name: string) {
    console.log("ConsolidatedAgent constructor llamado");
    console.log("Base URL:", baseUrl);
    console.log("Nombre del agente:", name);
    const holderRouter = Router();
    const issuerRouter = Router();
    const verifierRouter = Router();

    super({
      port: 0,
      name,
      modules: {
        askar: new AskarModule({
          ariesAskar: require("@hyperledger/aries-askar-nodejs"),
        }),
        openId4VcHolder: new OpenId4VcHolderModule(),
        openId4VcIssuer: new OpenId4VcIssuerModule({
          baseUrl: `${baseUrl}/oid4vci`,
          router: issuerRouter,
          endpoints: {
            credential: {
              credentialRequestToCredentialMapper: (...args) =>
                Issuer.getCredentialRequestToCredentialMapper({
                  issuerDidKey: this.didKey,
                })(...args),
            },
          },
        }),
        openId4VcVerifier: new OpenId4VcVerifierModule({
          baseUrl: `${baseUrl}/siop`,
          router: verifierRouter,
        }),
      },
    });

    app.use("/holder", holderRouter);
    app.use("/issuer", issuerRouter);
    app.use("/verifier", verifierRouter);
  }

  public static async build(
    app: Application,
    baseUrl: string
  ): Promise<ConsolidatedAgent> {
    console.log("Inicializando ConsolidatedAgent...");
    console.log("Base URL recibida:", baseUrl);

    const agentSecret = process.env.AGENT_SECRET || "default_secret_value";
    console.log("Agent Secret:", agentSecret);

    const agent = new ConsolidatedAgent(
      app,
      baseUrl,
      "tantan-wallet_13122024_v2"
    );

    console.log("Inicializando el agente...");
    await agent.initializeAgent(agentSecret);
    console.log("Agente inicializado.");

    console.log("Configurando registro de holder...");
    agent.holderRecord = await agent.agent.modules.openId4VcHolder;
    console.log("Holder configurado:", agent.holderRecord);

    console.log("Configurando registro de issuer...");
    agent.issuerRecord = await agent.agent.modules.openId4VcIssuer.createIssuer(
      {
        credentialsSupported,
      }
    );
    console.log("Issuer configurado:", agent.issuerRecord);

    console.log("Configurando registro de verifier...");
    agent.verifierRecord =
      await agent.agent.modules.openId4VcVerifier.createVerifier();
    console.log("Verifier configurado:", agent.verifierRecord);

    return agent;
  }
}
