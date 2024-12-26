import crypto from "crypto";

export const getWalletConfig = () => ({
  id: "tantan_wallet", // ID constante
  key: crypto.randomBytes(32).toString("hex"), // Clave dinámica
});
