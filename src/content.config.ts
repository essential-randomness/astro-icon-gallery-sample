import { defineCollection, z } from "astro:content";
import { glob as astroGlobLoader, file } from "astro/loaders";
import { glob, readFile } from "node:fs/promises";
import { parse } from "yaml";

import { picsLoader } from "./loaders/pics";
import path from "node:path";

// A loader that is exactly the loader passed in, but also has a
// `images` property which loads all the images in the "gallery path"
const loaderWithImages = withImageLoader(astroGlobLoader);
defineCollection({
  // give it the same thing as the astro loader does
  loader: loaderWithImages("/src/gallery/**"),
  schema: ({ image }) =>
    withLoadedImages(
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
      (obj, images) => {
        // any code to go from `obj` to the schema you want to have
        // given the images
        obj[characters] = getImageByCharacter(images);
      }
    ),
});

async function getAllImagesForFileEntry(entryFilePath: string) {
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

  return imagePathsByCharacter.map((imagePath) => ({
    relativePath: imagePath,
    image: `/@fs` + path.resolve(galleryPath, imagePath),
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
          images: await getAllImagesForFileEntry(charactersFile),
        };
      })
    );

    return characterData;
  },
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string(),
        cover: image().optional(),
        images: z
          .array(
            z.object({
              relativePath: z.string(),
              image: image(),
            })
          )
          .default([]),
        characters: z
          .array(
            z.object({
              name: z.string(),
              icons: z.array(image()),
            })
          )
          .default([]),
      })
      .transform((obj) => {
        const characterNames = Array.from(
          new Set(
            obj.images
              .map((imageFilePath) => {
                // Since the folder names inside the gallery are the character names, the
                // character name will be the first folder in the returned paths.
                return imageFilePath.relativePath.substring(
                  0,
                  imageFilePath.relativePath.indexOf("/")
                );
              })
              .filter((name) => !!name)
          )
        );

        const charactersIcons = characterNames.map((character) => ({
          name: character,
          icons: obj.images
            .filter((src) => src.relativePath.startsWith(character))
            .map((image) => image.image),
        }));

        obj["characters"] = charactersIcons;

        return obj;
      }),
});

export const collections = { icons };
