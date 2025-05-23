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

function withImagesSchema<T extends z.AnyZodObject>(
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
    await Promise.all(
      context.store.values().map(async (value) => {
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

/**
 * Assume a content directory with the following structure:
 *
 * series1.yml
 * series2.yml
 * /series1/["collection of images for series 1"]
 * /series2/["collection of images for series 2"]
 *
 * We want to load all the images for each series in this content
 * collection WITHOUT having to explicitly list every image in the
 * YAML file. We also want to make this work regardless of loader type.
 */
const icons = defineCollection({
  // We wrap our loader (in this case the default glob loader from Astro)
  // with the `withImages` function. With this, each element in our
  // collection loaded by the original loader will also have an
  // additional `images` property with all the images in the corresponding directory.
  loader: withImages(
    astroGlobLoader({
      pattern: "**/*.yml",
      base: "./src/content/gallery",
    })
  ),
  // If we want type safety, we can wrap the schema with the `withImagesSchema`
  // function, which will add the `images` property to our output.
  schema: withImagesSchema(
    ({ image }) =>
      z.object({
        title: z.string(),
        description: z.string(),
        cover: image().optional(),
        characters: z.string().array().default([]),
      }),
    // Optionally, we can also add a second argument to `withImagesSchema` which
    // allows us to use the loaded images to set the value of properties in the final
    // object using the loaded images.
    (result, allImages) => {
      result["characters"] = Array.from(
        // In this case, the images are divided by characters, which means we can
        // use the first folder in the path to collect all the names of the characters
        new Set(allImages.map((img) => img.relativePath.split("/")[0]))
      );
    }
  ),
});

export const collections = { icons };
