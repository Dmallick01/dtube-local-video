const VIDEO_EXT = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'];

export const scanFiles = async (dataTransferItemList) => {
  const files = [];

  const readEntry = async (entry, pathPrefix = '') => {
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve));
      const ext = file.name.split('.').pop().toLowerCase();
      if (VIDEO_EXT.includes(ext)) {
        file.id = `${pathPrefix}${file.name}-${file.size}-${file.lastModified}`;
        file.webkitRelativePath = pathPrefix + file.name;
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readAllEntries = async () => {
        let allEntries = [];
        const read = async () => {
          const entries = await new Promise((resolve) => dirReader.readEntries(resolve));
          if (entries.length > 0) {
            allEntries = allEntries.concat(entries);
            await read();
          }
        };
        await read();
        return allEntries;
      };
      const entries = await readAllEntries();
      const sub = pathPrefix + entry.name + '/';
      for (const ent of entries) {
        await readEntry(ent, sub);
      }
    }
  };

  for (let i = 0; i < dataTransferItemList.length; i++) {
    const entry = dataTransferItemList[i].webkitGetAsEntry();
    if (entry) await readEntry(entry, '');
  }
  return files;
};
