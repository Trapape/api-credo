# Usa una imagen base de Node.js (Debian)
FROM node:20

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instala las dependencias de compilación
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc libc6-dev libtool autoconf automake nasm git pkg-config

# Copia los archivos package.json y yarn.lock al directorio de trabajo
COPY package*.json yarn.lock ./

# Descarga yarn version 4.5.3
RUN wget https://repo.yarnpkg.com/4.5.3/packages/yarnpkg-cli/bin/yarn.js -O /usr/local/bin/yarn.js && chmod +x /usr/local/bin/yarn.js

# Copia el resto del código fuente al directorio de trabajo
COPY . .

# Instala las dependencias usando yarn
RUN /usr/local/bin/yarn.js install

# Define el puerto que la aplicación expone
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["yarn", "start"]
