import swaggerAutogen from 'swagger-autogen';

const doc = {
    info: {
        title: 'Ride Booking API',
        description: 'API Documentation for the Ride Booking Service',
    },
    host: 'localhost:3000',
    schemes: ['http'],
};

const outputFile = './src/swagger-output.json';
const endpointsFiles = ['./src/app.ts'];

swaggerAutogen()(outputFile, endpointsFiles, doc);
