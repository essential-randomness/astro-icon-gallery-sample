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

function loaderWithImages(
  ...params: Parameters<typeof astroGlobLoader>
): Loader {
  return {
    name: astroGlobLoader.name + "-with-images",
    // Called when updating the collection.
    load: async (context): Promise<void> => {
      console.log("NEW LOADER");
      console.log("NEW LOADER");
      console.log("NEW LOADER");
      console.log("NEW LOADER");
      console.log("NEW LOADER");
      await astroGlobLoader(...params).load(context);
      // All loader entries are from this current loader
      await Promise.all(
        context.store.values().map(async (value) => {
          console.log(value);
          const promise = await getAllImagesForFileEntry(
            value.filePath as string
          );
          context.store.set({
            id: value.id,
            data: {
              ...value,
              images: await promise,
            },
          });

          return promise;
        })
      );
      console.dir(context.store.values(), { depth: null });
      console.log("BYE LOADER");
      console.log("BYE LOADER");
      console.log("BYE LOADER");
      console.log("BYE LOADER");
      console.log("BYE LOADER");
      console.log("BYE LOADER");
    },
  };
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
    obj: z.infer<T> & ImagesSchema,
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
      return augmentedSchema.transform((obj) => {
        transformFunction(
          obj as unknown as z.infer<T> & ImagesSchema,
          obj.images
        );

        return obj;
      });
    }
    return augmentedSchema;
  };
}
function withImages(loader: Loader) {
  const oldLoad = loader.load;
  loader.load = async (context: LoaderContext) => {
    await oldLoad({ ...context, parseData: async (data) => data.data });
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
              id: value.id,
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

// A loader that is exactly the loader passed in, but also has a
// `images` property which loads all the images in the "gallery path"
// const loaderWithImages = withImageLoader(astroGlobLoader);
// defineCollection({
//   // give it the same thing as the astro loader does
//   loader: loaderWithImages("/src/gallery/**"),
//   schema: ({ image }) =>
//     withLoadedImages(
//       z.object({
//         title: z.string(),
//         description: z.string(),
//         cover: image().optional(),
//         characters: z
//           .array(
//             z.object({
//               name: z.string(),
//               icons: z.array(image()),
//             })
//           )
//           .default([]),
//       }),
//       (obj, images) => {
//         // any code to go from `obj` to the schema you want to have
//         // given the images
//         obj[characters] = getImageByCharacter(images);
//       }
//     ),
// });

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
        // cover: image().optional(),
        characters: z.string().array().default([]),
      }),
    (object, images) => {
      //   console.log(object);
      console.log("transform");
      console.log(images.map((img) => img.relativePath.split("/")[0]));
      object["characters"] = Array.from(
        new Set(images.map((img) => img.relativePath.split("/")[0]))
      );
    }
  ),
});

// const icons = defineCollection({
//   loader: async () => {
//     const charactersFiles = await Array.fromAsync(
//       glob("src/content/gallery/*.yml")
//     );
//     const characterData = await Promise.all(
//       charactersFiles.map(async (charactersFile) => {
//         const fileContent = await readFile(charactersFile, "utf-8");
//         const parsedYaml = parse(fileContent);
//         const fileName = path.parse(charactersFile);

//         return {
//           id: fileName.name,
//           ...parsedYaml,
//           cover: parsedYaml.cover
//             ? `/@fs` + path.resolve("src/content/gallery/", parsedYaml.cover)
//             : undefined,
//           images: await getAllImagesForFileEntry(charactersFile),
//         };
//       })
//     );

//     return characterData;
//   },
//   schema: ({ image }) =>
//     z
//       .object({
//         title: z.string(),
//         description: z.string(),
//         cover: image().optional(),
//         images: z
//           .array(
//             z.object({
//               relativePath: z.string(),
//               image: image(),
//             })
//           )
//           .default([]),
//         characters: z
//           .array(
//             z.object({
//               name: z.string(),
//               icons: z.array(image()),
//             })
//           )
//           .default([]),
//       })
//       .transform((obj) => {
//         const characterNames = Array.from(
//           new Set(
//             obj.images
//               .map((imageFilePath) => {
//                 // Since the folder names inside the gallery are the character names, the
//                 // character name will be the first folder in the returned paths.
//                 return imageFilePath.relativePath.substring(
//                   0,
//                   imageFilePath.relativePath.indexOf("/")
//                 );
//               })
//               .filter((name) => !!name)
//           )
//         );

//         const charactersIcons = characterNames.map((character) => ({
//           name: character,
//           icons: obj.images
//             .filter((src) => src.relativePath.startsWith(character))
//             .map((image) => image.image),
//         }));

//         obj["characters"] = charactersIcons;

//         return obj;
//       }),
// });

export const collections = { icons };
