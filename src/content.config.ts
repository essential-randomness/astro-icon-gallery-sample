import { defineCollection, z } from "astro:content";
// import { glob, file } from "astro/loaders";
import { glob, readFile } from "node:fs/promises";
import { parse } from "yaml";

import { picsLoader } from "./loaders/pics";
import path from "node:path";

async function getCharactersAndImages(entryFilePath: string) {
  const entryPath = path.parse(entryFilePath);
  const galleryPath = path.join(entryPath.dir, entryPath.name);
  const charactersImageFiles = await Array.fromAsync(
    glob(galleryPath + "/**/*.{jpeg,jpg,png,gif}")
  );
  // Get the relative path of the characterImage, starting from galleryPath
  // These will all start with the character name
  const imagePathsByCharacter = charactersImageFiles.map(
    (charactersImageFile) => path.relative(galleryPath, charactersImageFile)
  );
  const characterNames = Array.from(
    new Set(
      imagePathsByCharacter
        .map((imageFilePath) => {
          // Since the folder names inside the gallery are the character names, the
          // character name will be the first folder in the returned paths.
          return imageFilePath.substring(0, imageFilePath.indexOf("/"));
        })
        .filter((name) => !!name)
    )
  );

  return characterNames.map((character) => ({
    name: character,
    icons: imagePathsByCharacter
      .filter((src) => src.startsWith(character))
      .map((relativePath) => `/@fs` + path.resolve(galleryPath, relativePath)),
  }));
}

const icons = defineCollection({
  loader: async () => {
    const charactersFiles = await Array.fromAsync(
      glob("src/content/gallery/*.yml")
    );
    const characterData = await Promise.all(
      charactersFiles.map(async (charactersFile) => {
        const fileContent = await readFile(charactersFile, "utf-8");
        const parsedYaml = parse(fileContent);
        const fileName = path.parse(charactersFile);

        return {
          id: fileName.name,
          ...parsedYaml,
          cover: parsedYaml.cover
            ? `/@fs` + path.resolve("src/content/gallery/", parsedYaml.cover)
            : undefined,
          characters: await getCharactersAndImages(charactersFile),
        };
      })
    );

    return characterData;
  },
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      cover: image().optional(),
      characters: z
        .array(
          z.object({
            name: z.string(),
            icons: z.array(image()),
          })
        )
        .default([]),
    }),
});

export const collections = { icons };
