FROM node:20-alpine3.16
# Set the working directory in the container
WORKDIR /app
# Copy all files from the src folder to the working directory
COPY src/ .
# Run npm init with the -y flag to automatically generate a package.json file with default values
RUN npm init -y
# Install Express
RUN npm i express
# Expose the port that the app will run on
EXPOSE 80
# Start the app
CMD [ "node", "index.js" ]