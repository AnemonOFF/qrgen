"use client";

import BarcodeGenerator from "@/components/BarcodeGenerator";
import QrGenerator from "@/components/QrGenerator";
import { Textarea, Input } from "@nextui-org/input";
import { Select, SelectItem } from "@nextui-org/select";
import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState(-1);
  const [eccl, setEccl] = useState(-1);
  const [version, setVersion] = useState(0);
  const [mask, setMask] = useState(-1);
  const [modSize, setModSize] = useState(4);
  const [margin, setMargin] = useState(4);

  return (
    <main className="flex min-h-screen flex-col items-center gap-5 justify-between p-12">
      <div className="flex gap-5 w-full max-lg:flex-col max-lg:items-center max-w-[800px]">
        <div className="flex flex-col gap-5 grow">
          <Textarea
            label="Текст для кодирования"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Select
            label="Метод кодирования"
            value={mode.toString()}
            defaultSelectedKeys={["-1"]}
            onChange={(e) => {
              setMode(parseInt(e.target.value));
            }}
          >
            <SelectItem key={"-1"} value={"-1"}>
              Авто
            </SelectItem>
            <SelectItem key={"1"} value={"1"}>
              Числовой
            </SelectItem>
            <SelectItem key={"2"} value={"2"}>
              Буквенно-цифровой
            </SelectItem>
            <SelectItem key={"4"} value={"4"}>
              Октетный
            </SelectItem>
          </Select>
          <Select
            label="Уровень коррекции"
            value={eccl.toString()}
            defaultSelectedKeys={["-1"]}
            onChange={(e) => {
              setEccl(parseInt(e.target.value));
            }}
          >
            <SelectItem key={"-1"} value={"-1"}>
              Авто
            </SelectItem>
            <SelectItem key={"1"} value={"1"}>
              L
            </SelectItem>
            <SelectItem key={"0"} value={"0"}>
              M
            </SelectItem>
            <SelectItem key={"3"} value={"3"}>
              Q
            </SelectItem>
            <SelectItem key={"2"} value={"2"}>
              H
            </SelectItem>
          </Select>
          <Input
            type="number"
            label="Версия"
            min={0}
            max={40}
            value={version.toString()}
            onChange={(e) => setVersion(parseInt(e.target.value))}
          />
          <Input
            type="number"
            label="Шаблон маски"
            min={-1}
            max={7}
            value={mask.toString()}
            onChange={(e) => setMask(parseInt(e.target.value))}
          />
          <Input
            type="number"
            label="Размер модуля"
            min={1}
            value={modSize.toString()}
            onChange={(e) => setModSize(parseInt(e.target.value))}
          />
          <Input
            type="number"
            label="Размер свободной зоны"
            min={0}
            value={margin.toString()}
            onChange={(e) => setMargin(parseInt(e.target.value))}
          />
        </div>
        <QrGenerator
          params={
            text
              ? {
                  eccl,
                  margin,
                  mask,
                  mode,
                  modSize,
                  text,
                  version: version === 0 ? -1 : version,
                }
              : null
          }
        />
      </div>
      <BarcodeGenerator text={text} />
    </main>
  );
}
