import type {
  InitConfig,
  KeyDidCreateOptions,
  ModulesMap,
  VerificationMethod,
} from "@credo-ts/core";
import {
  Agent,
  DidKey,
  HttpOutboundTransport,
  KeyType,
  TypedArrayEncoder,
} from "@credo-ts/core";
import { HttpInboundTransport, agentDependencies } from "@credo-ts/node";
import type { Express } from "express";
import express from "express";
import fs from "fs";
import { greenText } from "../utils/OutputClass";

export class BaseAgent<AgentModules extends ModulesMap> {
  public app: Express;
  public port: number;
  public name: string;
  public config: InitConfig;
  public agent: Agent<AgentModules>;
  public did!: string;
  public didKey!: DidKey;
  public kid!: string;
  public verificationMethod!: VerificationMethod;
  private DID_FILE!: string;

  public constructor({
    port,
    name,
    modules,
  }: {
    port: number;
    name: string;
    modules: AgentModules;
  }) {
    this.name = name;
    this.port = port;
    this.app = express();
    this.DID_FILE = "./did-data.json";

    const config = {
      label: name,
      walletConfig: { id: name, key: name },
    } satisfies InitConfig;

    this.config = config;

    this.agent = new Agent({
      config,
      dependencies: agentDependencies,
      modules,
    });

    const httpInboundTransport = new HttpInboundTransport({
      app: this.app,
      port: this.port,
    });
    const httpOutboundTransport = new HttpOutboundTransport();

    this.agent.registerInboundTransport(httpInboundTransport);
    this.agent.registerOutboundTransport(httpOutboundTransport);
  }

  public async initializeAgent(secretPrivateKey: string) {
    await this.agent.initialize();

    // Verificar si el archivo DID existe
    // **NOTA**: En un entorno de producción, las rutas locales para las claves privadas
    // o los archivos sensibles (como el DID original) deben almacenarse en un lugar más seguro
    // fuera del proyecto. Se recomienda usar un gestor de secretos o almacenamiento seguro.
    if (fs.existsSync(this.DID_FILE)) {
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
            privateKeys: privateKeys,
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
    }

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
}
