import { defineCollection, z } from 'astro:content';
import { glob, file } from "astro/loaders";

import { picsLoader } from "./loaders/pics";

const icons = defineCollection({
	loader: glob({ pattern: "**/*.yml", base: "./src/content/gallery" }),
	schema: ({ image }) => z.object({
		title: z.string(),
		description: z.string(),
		cover: image().optional(),
	}),
});

export const collections = { icons };
