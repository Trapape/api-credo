# Usa una imagen base de Node.js
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos package.json y yarn.lock al directorio de trabajo
COPY package*.json yarn.lock ./

# Instala las dependencias usando yarn
RUN yarn install

# Copia el resto del código fuente al directorio de trabajo
COPY . .

# Define el puerto que la aplicación expone
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["yarn", "start"]
