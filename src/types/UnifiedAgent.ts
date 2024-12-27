import { AskarModule } from "@credo-ts/askar";
import {
  Agent,
  DidKey,
  HttpOutboundTransport,
  InitConfig,
  KeyDidCreateOptions,
  KeyType,
  TypedArrayEncoder,
  VerificationMethod,
} from "@credo-ts/core";
import { agentDependencies, HttpInboundTransport } from "@credo-ts/node";
import {
  OpenId4VcHolderModule,
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuanceSessionStateChangedEvent,
  OpenId4VcIssuerEvents,
  OpenId4VcIssuerModule,
  OpenId4VcVerifierModule,
} from "@credo-ts/openid4vc";
import "dotenv/config";
import type { Express } from "express";
import { Router } from "express";
import fs from "fs";
import { credentialsSupported, display, Issuer } from "../models/Issuer";
import { greenText } from "../utils/OutputClass";
import { CustomModules } from "./CustomModules";

export class UnifiedAgent {
  public name: string;
  public config: InitConfig;
  public agent: Agent;
  public did!: string;
  public didKey!: DidKey;
  public kid!: string;
  public verificationMethod!: VerificationMethod;
  private DID_FILE!: string;
  public holderRecord: any;
  public issuerRecord: any;
  public verifierRecord: any;
  private issuerRouter: Router;
  private verifierRouter: Router;

  constructor(
    name: string,
    _app: Express,
    _issuerRouter: Router,
    _verifierRouter: Router
  ) {
    console.log("UnifiedAgent constructor llamado");
    //const baseUrl = `${process.env.BASE_URL}:${process.env.API_PORT || 3000}`;
    const baseUrl = `${process.env.BASE_URL}`;
    this.name = name;
    this.DID_FILE = "./did-data.json";
    this.issuerRouter = _issuerRouter;
    this.verifierRouter = _verifierRouter;

    const config = {
      label: name,
      walletConfig: { id: name, key: name },
    } satisfies InitConfig;

    this.config = config;

    this.agent = new Agent<CustomModules>({
      config,
      dependencies: agentDependencies,
      modules: {
        askar: new AskarModule({
          ariesAskar: require("@hyperledger/aries-askar-nodejs"),
        }),
        openId4VcHolder: new OpenId4VcHolderModule(),
        openId4VcIssuer: new OpenId4VcIssuerModule({
          baseUrl: `${baseUrl}/oid4vci`,
          router: this.issuerRouter,
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
          router: this.verifierRouter,
        }),
      },
    });
  }

  public async registerTransports(_app: Express) {
    console.log("Registrando transportes para el agente...");

    const httpInboundTransport = new HttpInboundTransport({
      app: _app, // Usa la instancia de Express
      port: Number(process.env.API_PORT) || 3000,
    });

    const httpOutboundTransport = new HttpOutboundTransport();

    this.agent.registerInboundTransport(httpInboundTransport);
    this.agent.registerOutboundTransport(httpOutboundTransport);

    console.log("Transportes registrados correctamente.");
  }

  public async initializeAgent(secretPrivateKey: string) {
    await this.agent.initialize();

    // Verificar si el archivo DID existe
    // **NOTA**: En un entorno de producción, las rutas locales para las claves privadas
    // o los archivos sensibles (como el DID original) deben almacenarse en un lugar más seguro
    // fuera del proyecto. Se recomienda usar un gestor de secretos o almacenamiento seguro.
    /*if (fs.existsSync(this.DID_FILE)) {
      console.log("Archivo DID encontrado. Cargando datos del archivo...");
      const privateKeys = JSON.parse(
        fs.readFileSync("privateKeys.json", "utf8")
      ); // Cargar claves privadas

      try {
        // Leer y parsear los datos del archivo
        const didData = JSON.parse(fs.readFileSync(this.DID_FILE, "utf8"));

        // Configurar las propiedades desde los datos del archivo
        this.did = didData.did;
        this.didKey = DidKey.fromDid(this.did);
        this.kid = didData.kid;
        this.verificationMethod = didData.verificationMethod;

        console.log(greenText("Agente inicializado con datos del archivo:"));
        console.log("DID:", this.did);
        console.log("DID Key:", this.didKey);
        console.log("KID:", this.kid);
        console.log("Verification Method:", this.verificationMethod);

        // Importar el DID al agente si es necesario
        try {
          await this.agent.dids.import({
            did: this.did,
            didDocument: didData.didDocument,
            privateKeys: didData.verificationMethod,
            overwrite: true,
          });
          console.log(greenText("DID importado al agente correctamente."));
        } catch (error) {
          console.warn(
            "El DID ya estaba registrado o no se pudo importar:",
            error
          );
        }
        return;
      } catch (error) {
        console.error("Error al cargar los datos del archivo:", error);
        throw new Error(
          "No se pudo cargar el archivo DID. Verifica el formato."
        );
      }
    }*/

    //*Uso del Método update
    //*El método update se utiliza para modificar un documento DID existente. Esto es útil si necesitas:
    //*
    //*   -Cambiar la clave pública o privada asociada al DID.
    //*   -Actualizar métodos de verificación o servicios en el documento DID.
    //*   -Realizar modificaciones que cumplan con la especificación DID Registration.

    /*const updateResult = await this.agent.dids.update({
        did: this.did,
        document: {
          ...this.didDocument,
          authentication: [
            {
              id: `${this.did}#newKey`,
              type: "Ed25519VerificationKey2020",
              controller: this.did,
              publicKeyBase58: "newPublicKeyBase58Value",
            },
          ],
        },
      });

      console.log("Resultado de la actualización del DID:", updateResult);
      return;*/

    // **NOTA**: Este bloque de creación solo se debe usar para desarrollo.
    // En producción, el DID ya debe existir y se conectará a otras wallets
    // u organizaciones con un DID oficial proporcionado externamente.
    const didCreateResult = await this.agent.dids.create<KeyDidCreateOptions>({
      method: "key",
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString(secretPrivateKey) },
    });

    const privateKeys = didCreateResult.didState.secret; // Obtén las claves privadas

    // Configurar los datos del DID
    this.did = didCreateResult.didState.did as string;
    this.didKey = DidKey.fromDid(this.did);
    this.kid = `${this.did}#${this.didKey.key.fingerprint}`;

    const verificationMethod =
      didCreateResult.didState.didDocument?.dereferenceKey(this.kid, [
        "authentication",
      ]);
    if (!verificationMethod) throw new Error("No verification method found");
    this.verificationMethod = verificationMethod;

    // Obtener el didDocument completo
    const didDocument = didCreateResult.didState.didDocument;

    const didData = {
      did: this.did,
      didKey: {
        id: this.didKey.did,
        key: this.didKey.key,
        fingerprint: this.didKey.key.fingerprint,
      },
      kid: this.kid,
      verificationMethod: {
        id: verificationMethod.id,
        type: verificationMethod.type,
        controller: verificationMethod.controller,
        publicKeyBase58: verificationMethod.publicKeyBase58,
      },
      didDocument: didDocument ? didDocument.toJSON() : null, // Convertir el documento DID a JSON
    };

    // Escribir los datos en el archivo
    try {
      // **NOTA**: En entornos seguros, las claves privadas deben guardarse
      // de forma cifrada o en un servicio de gestión de claves (KMS).
      fs.writeFileSync(
        "privateKeys.json",
        JSON.stringify(privateKeys, null, 2)
      );
      fs.writeFileSync(this.DID_FILE, JSON.stringify(didData, null, 2));
      console.log("Datos del DID guardados correctamente en:", this.DID_FILE);
    } catch (error) {
      console.error("Error al guardar los datos del DID:", error);
    }

    console.log(greenText("Agente inicializado con los siguientes datos:"));
    console.log("DID:", this.did);
    console.log("DID Key:", this.didKey);
    console.log("KID:", this.kid);
    console.log("Verification Method:", this.verificationMethod);

    const createdDids = await this.agent.dids.getCreatedDids({});
    console.log(
      "DIDs creados por el agente (detalles):",
      JSON.stringify(createdDids, null, 2)
    );

    for (const record of createdDids) {
      console.log("Resolviendo DID:", record.did);
      const resolvedDid = await this.agent.dids.resolve(record.did);
      console.log(
        "DID resuelto (detalles):",
        JSON.stringify(resolvedDid, null, 2)
      );

      resolvedDid.didDocument?.verificationMethod?.forEach((vm) => {
        console.log("Verificando método:", vm);
      });
    }

    console.log(greenText(`\nAgent ${this.name} created!\n`));
  }

  public static async build(
    _name: string,
    _app: Express,
    _issuerRouter: Router,
    _verifierRouter: Router
  ): Promise<UnifiedAgent> {
    const agent = new UnifiedAgent(_name, _app, _issuerRouter, _verifierRouter);
    console.log("Inicializando el agente...");
    await agent.initializeAgent(
      process.env.AGENT_SECRET || "default_secret_value"
    );
    console.log("Agente inicializado.");

    console.log("Configurando registro de holder...");
    agent.holderRecord = await agent.agent.modules.openId4VcHolder;
    console.log("Holder configurado:", agent.holderRecord);

    console.log("Configurando registro de issuer...");
    agent.issuerRecord = await agent.agent.modules.openId4VcIssuer.createIssuer(
      {
        display,
        credentialsSupported,
      }
    );

    // Listener global para todas las sesiones
    agent.agent.events.on<OpenId4VcIssuanceSessionStateChangedEvent>(
      OpenId4VcIssuerEvents.IssuanceSessionStateChanged,
      (event) => {
        console.log(greenText("GLOBAL: Issuance session state changed:"));
        console.log("Session ID:", event.payload.issuanceSession.id);
        console.log("New state:", event.payload.issuanceSession.state);

        // Reaccionar al estado de la sesión
        switch (event.payload.issuanceSession.state) {
          case OpenId4VcIssuanceSessionState.Completed:
            console.log(greenText("Emisión completada con éxito."));
            break;
          case OpenId4VcIssuanceSessionState.Error:
            console.error(greenText("La emisión falló."));
            break;
          case OpenId4VcIssuanceSessionState.OfferCreated:
            console.log(greenText("La oferta fue creada."));
            break;
          case OpenId4VcIssuanceSessionState.OfferUriRetrieved:
            console.log(greenText("El URI de la oferta fue recuperado."));
            break;
          case OpenId4VcIssuanceSessionState.AccessTokenRequested:
            console.log(greenText("Se solicitó un token de acceso."));
            break;
          case OpenId4VcIssuanceSessionState.AccessTokenCreated:
            console.log(greenText("Se creó un token de acceso."));
            break;
          case OpenId4VcIssuanceSessionState.CredentialRequestReceived:
            console.log(greenText("Se recibió una solicitud de credenciales."));
            break;
          case OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued:
            console.log(
              greenText("Las credenciales fueron parcialmente emitidas.")
            );
            break;
          default:
            console.warn(
              greenText(
                "Estado desconocido:",
                event.payload.issuanceSession.state
              )
            );
        }
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
