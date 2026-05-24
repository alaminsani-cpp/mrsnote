// src/components/JoyPixelEmoji.jsx
import React, { useMemo } from 'react';
import emojiToolkit from 'emoji-toolkit';

// Configure emoji-toolkit to use the free CDN
emojiToolkit.imagePathPNG = 'https://cdn.jsdelivr.net/npm/emoji-toolkit@10.0.0/png/32/';
emojiToolkit.emojiSize = '32';

const JoyPixelEmoji = ({ children }) => {
  const convertedText = useMemo(() => {
    // Convert any native emoji or shortname in the text to an <img> tag
    return emojiToolkit.toImage(children);
  }, [children]);

  return <span dangerouslySetInnerHTML={{ __html: convertedText }} />;
};

export default JoyPixelEmoji;