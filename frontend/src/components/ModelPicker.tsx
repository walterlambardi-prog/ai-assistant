"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OllamaModel } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";

type Props = {
  value: string;
  onChange: (model: string) => void;
};

export default function ModelPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getConfig().then((c) => setDefaultModel(c.defaultModel)).catch(() => undefined);
    api
      .listOllamaModels()
      .then((r) => setModels(r.models))
      .catch((e) => setErr(e.message));
  }, []);

  const options = new Set<string>();
  if (value) options.add(value);
  if (defaultModel) options.add(defaultModel);
  for (const m of models) options.add(m.name);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "auto", minWidth: 180 }}
      title={err ? `${t("modelPicker.errorTitle")}${err}` : t("modelPicker.title")}
    >
      <option value="">{t("modelPicker.default")}: {defaultModel || "—"}</option>
      {Array.from(options).map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
