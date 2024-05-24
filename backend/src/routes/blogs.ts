import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { verify } from "hono/jwt";
import { createPostInput, updatePostInput } from "@nilesh_bhoi/medium-common";

export const blogRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string;
        JWT_SECRET: string;
    };
    Variables: {
        userId: string;
    };
}>();

// middleware
blogRouter.use("/*", async (c, next) => {
    console.log("hello from the middleware");
    const jwt = c.req.header("Authorization") || "";
    console.log("jwt: ", jwt);
    if (!jwt) {
        c.status(401);
        return c.json({ error: "unauthorized" });
    }
    const token = jwt.split(" ")[1];

    console.log("token: ", token);

    const payload = await verify(token, c.env.JWT_SECRET);
    if (!payload) {
        c.status(403);
        return c.json({ error: "unauthorized" });
    }

    //@ts-ignore
    c.set("userId", payload.id);

    await next();
});

// ideally should add pagination to this endpoint, should not return all the posts can be too much 10^9
blogRouter.get("/bulk", async (c) => {
    const prisma = new PrismaClient({
        datasourceUrl: c.env?.DATABASE_URL,
    }).$extends(withAccelerate());

    const posts = await prisma.post.findMany();
    return c.json({ posts });
});

blogRouter.get("/:id", async (c) => {
    const prisma = new PrismaClient({
        datasourceUrl: c.env?.DATABASE_URL,
    }).$extends(withAccelerate());

    const id = c.req.param("id");

    try {
        const post = await prisma.post.findFirst({
            where: {
                id: id,
            },
        });
        return c.json({ post });
    } catch (error) {
        c.status(404);
        return c.json({
            error: "Error while fetching the post",
        });
    }
});

blogRouter.post("/post", async (c) => {
    const body = await c.req.json();
    const { success } = createPostInput.safeParse(body);
    if (!success) {
        c.status(411);
        return c.json({
            message: "Inputs not correct",
        });
    }

    const prisma = new PrismaClient({
        datasourceUrl: c.env?.DATABASE_URL,
    }).$extends(withAccelerate());

    const userId = c.get("userId"); // taken care by middleware as the token is passed it will set it

    try {
        const post = await prisma.post.create({
            data: {
                title: body.title,
                content: body.content,
                authorId: userId,
            },
        });

        return c.json({ id: post.id });
    } catch (error) {
        c.status(403);
        return c.json({ userId, body, error });
    }
});

// blogRouter.delete("/delete/:id", async (c) => {
//     const prisma = new PrismaClient({
//         datasourceUrl: c.env?.DATABASE_URL,
//     }).$extends(withAccelerate());
//     const postID = JSON.stringify(c.req.param("id"));
//     console.log("ID of the post to be deleted: ", postID);
//     const post = await prisma.post.delete({
//         where: {
//             id: "54d53151-ce13-49f1-9f61-b5d4bbaed806",
//         },
//     });
//     return c.json({ id: post.id });
// });

blogRouter.put("/", async (c) => {
    const body = await c.req.json();
    const { success } = updatePostInput.safeParse(body);

    if (!success) {
        c.status(411);
        return c.json({
            message: "Inputs not correct",
        });
    }

    const prisma = new PrismaClient({
        datasourceUrl: c.env?.DATABASE_URL,
    }).$extends(withAccelerate());

    const authorId = c.get("userId");

    const post = await prisma.post.update({
        where: {
            id: body.id,
            authorId: authorId,
        },
        data: {
            title: body.title,
            content: body.content,
            published: true,
        },
    });

    return c.json({ id: post.id });
});
