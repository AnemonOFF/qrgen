"use client";

import { controlOptionsCreator } from "@/creator/controlOptionsCreator";
import { DataQR, QRCODE } from "@/creator/dataQr";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";

export type GeneratorParams = {
  text: string;
  mode: number;
  eccl: number;
  version: number;
  mask: number;
  modSize: number;
  margin: number;
};

interface QrGeneratorProps {
  params: GeneratorParams | null;
}

const QrGenerator: React.FC<QrGeneratorProps> = ({ params }) => {
  const [error, setError] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!params || !qrRef.current) return;
    const qrWrapper = qrRef.current;
    const qrCode = new DataQR(params.text, params);
    controlOptionsCreator(qrCode);
    if (!qrCode.error) {
      qrCode.dataToCodewords();
      qrCode.makeCodewordsQR();
      qrCode.makeMatrix();
    }

    const qrObject = qrCode.report();
    // qrWrapper.textContent = "";
    if (qrObject.error) {
      console.error(qrObject.error);
      setError(qrObject.error);
    }
    if (qrObject.result) {
      qrObject.result as HTMLCanvasElement;
      (qrObject.result as HTMLCanvasElement).style.width = "100%";
      qrWrapper.append(qrObject.result);
    }

    return () => {
      qrWrapper.textContent = "";
    };
  }, [params, qrRef]);

  return (
    <div id="QRResult" className="w-64" ref={qrRef}>
      {error && <div>Ошибка в {error}</div>}
    </div>
  );
};

export default React.memo(QrGenerator);
