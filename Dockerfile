FROM node:18
WORKDIR /index
COPY ./index
RUN npm install
EXPOSE 4000
CMD ["npm", "start"]