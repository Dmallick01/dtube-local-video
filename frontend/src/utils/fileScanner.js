export const scanFiles = async (dataTransferItemList) => {
  const files = [];
  
  const readEntry = async (entry) => {
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve));
      const ext = file.name.split('.').pop().toLowerCase();
      if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
        // Attach a unique ID
        file.id = Math.random().toString(36).substr(2, 9);
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      
      // readEntries only returns up to 100 entries at a time, need to loop
      const readAllEntries = async () => {
        let allEntries = [];
        let read = async () => {
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
      for (let i = 0; i < entries.length; i++) {
        await readEntry(entries[i]);
      }
    }
  };

  for (let i = 0; i < dataTransferItemList.length; i++) {
    const entry = dataTransferItemList[i].webkitGetAsEntry();
    if (entry) {
      await readEntry(entry);
    }
  }
  return files;
};
