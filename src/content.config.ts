import { defineCollection, z, type SchemaContext } from "astro:content";
import {
  glob as astroGlobLoader,
  file,
  type Loader,
  type LoaderContext,
} from "astro/loaders";
import { glob, readFile } from "node:fs/promises";
import { parse } from "yaml";

import { picsLoader } from "./loaders/pics";
import path from "node:path";
import { object } from "astro:schema";

async function getAllImagesForFileEntry(entryFilePath: string) {
  const entryPath = path.parse(entryFilePath);
  const galleryPath = path.join(entryPath.dir, entryPath.name);
  const charactersImageFiles = await Array.fromAsync(
    glob(galleryPath + "/*/**/*.{jpeg,jpg,png,gif}")
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

type ImagesSchema = z.ZodObject<{
  images: z.ZodArray<
    z.ZodObject<{
      image: ReturnType<SchemaContext["image"]>;
      relativePath: z.ZodString;
    }>
  >;
}> & {};

async function withImagesSchema<T extends z.AnyZodObject>(
  schemaFunction: (_: SchemaContext) => T,
  transformFunction?: (
    obj: z.infer<T> & z.infer<ImagesSchema>,
    images: z.infer<ImagesSchema>["images"]
  ) => void
) {
  return (context: SchemaContext) => {
    const schema = schemaFunction(context);
    const ImagesSchema = z.object({
      images: z.array(
        z.object({
          relativePath: z.string(),
          image: context.image(),
        })
      ),
    });
    let augmentedSchema = schema.merge(ImagesSchema) as T & ImagesSchema;
    if (transformFunction) {
      return augmentedSchema.transform<z.infer<T> & z.infer<ImagesSchema>>(
        (obj) => {
          transformFunction(
            obj as z.infer<T> & z.infer<ImagesSchema>,
            obj.images
          );

          return obj as z.infer<T> & z.infer<ImagesSchema>;
        }
      );
    }
    return augmentedSchema as typeof augmentedSchema & {};
  };
}
function withImages(loader: Loader) {
  const oldLoad = loader.load;
  loader.load = async (context: LoaderContext) => {
    await oldLoad({
      ...context,
      // We skip the parsing of the data at this stage because it will be done
      // at the stage with the images in
      parseData: async (data) => {
        return data.data;
      },
    });
    console.dir(context.store.values(), { depth: null });
    await Promise.all(
      context.store.values().map(async (value) => {
        console.dir("valoue in store");
        console.dir(value);
        const loadedPromise = Promise.withResolvers();
        getAllImagesForFileEntry(value.filePath as string).then(
          async (images) => {
            const { digest, ...valueWithoutDigest } = value;
            const newData = await context.parseData({
              id: value.id,
              data: {
                ...valueWithoutDigest.data,
                images: images,
              },
            });
            context.store.set({
              ...valueWithoutDigest,
              data: newData,
              digest: context.generateDigest(newData),
            });
            loadedPromise.resolve(images);
          }
        );

        return loadedPromise.promise;
      })
    );
  };

  return loader;
}

const icons = defineCollection({
  loader: withImages(
    astroGlobLoader({
      pattern: "**/*.yml",
      base: "./src/content/gallery",
    })
  ),
  schema: await withImagesSchema(
    ({ image }) =>
      z.object({
        title: z.string(),
        description: z.string(),
        cover: image().optional(),
        characters: z.string().array().default([]),
      }),
    (result, allImages) => {
      result["characters"] = Array.from(
        // The first folder in a path is the character name
        new Set(allImages.map((img) => img.relativePath.split("/")[0]))
      );
    }
  ),
});

export const collections = { icons };
