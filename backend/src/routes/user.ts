import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { sign, verify } from "hono/jwt";
import { signupInput, signinInput } from "@nilesh_bhoi/medium-common";

export const userRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string;
        JWT_SECRET: string;
    };
}>();

userRouter.post("/signup", async (c) => {
    const body = await c.req.json();
    const { success } = signupInput.safeParse(body);

    if (!success) {
        c.status(411);
        return c.json({
            message: "Inputs not correct",
        });
    }

    const prisma = new PrismaClient({
        datasourceUrl: c.env?.DATABASE_URL,
    }).$extends(withAccelerate());

    try {
        const newUser = await prisma.user.create({
            data: {
                email: body.email,
                password: body.password,
            },
        });

        const jwt = await sign({ id: newUser.id }, c.env.JWT_SECRET);

        return c.json({ jwt });
    } catch (error) {
        c.status(403);
        return c.json({ error: "error while signing up" });
    }
});

userRouter.post("/signin", async (c) => {
    const body = await c.req.json();
    const { success } = signinInput.safeParse(body);

    if (!success) {
        c.status(411);
        return c.json({
            message: "Inputs are not correct",
        });
    }

    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    const user = await prisma.user.findUnique({
        where: {
            email: body.email,
            password: body.password,
        },
    });

    if (!user) {
        c.status(403);
        return c.json({ error: "user not found" });
    }

    const jwt = await sign({ id: user.id }, c.env.JWT_SECRET);
    return c.json({ jwt });
});
