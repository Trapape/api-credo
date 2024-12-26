import { ModulesMap } from "@credo-ts/core";
import {
  OpenId4VcHolderModule,
  OpenId4VcIssuerModule,
  OpenId4VcVerifierModule,
} from "@credo-ts/openid4vc";

// Extender ModulesMap para incluir tus módulos personalizados
export interface CustomModules extends ModulesMap {
  openId4VcHolder: OpenId4VcHolderModule;
  openId4VcIssuer: OpenId4VcIssuerModule;
  openId4VcVerifier: OpenId4VcVerifierModule;
}
