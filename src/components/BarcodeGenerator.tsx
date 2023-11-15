"use client";

import React, { useEffect } from "react";
import Barcode from "react-barcode";

interface BarcodeGeneratorProps {
  text: string;
}

const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({ text }) => {
  useEffect(() => {}, [text]);

  return (
    <div className="max-w-full w-fit overflow-auto">
      <Barcode value={text} />
    </div>
  );
};

export default React.memo(BarcodeGenerator);
