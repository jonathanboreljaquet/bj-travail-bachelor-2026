import express from "express";
import matchRoutes from "./routes/match.route";
import availableSlotRoutes from "./routes/available_slot.route";
import authRoutes from "./routes/auth.route";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Padel Context API",
            version: "1.0.0",
            description: "API du travail de bachelor Padel Context",
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
    apis: ["./src/routes/*.ts"],
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
app.use("/api/matches", matchRoutes);
app.use("/api/available-slots", availableSlotRoutes);
app.use("/api/auth", authRoutes);

if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log("Serveur démarré avec succès!");
    });
}

export default app;
