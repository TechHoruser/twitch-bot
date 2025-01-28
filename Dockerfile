FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY . .
RUN ls -la
RUN npm install --production --silent
RUN chown -R node /app
USER node
CMD ["npm", "run", "start"]
