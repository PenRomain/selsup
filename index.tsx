import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useImperativeHandle,
  forwardRef,
  memo,
  ReactNode,
  PropsWithChildren,
  FC,
  useState,
  Ref,
} from "react";

type BaseParam = {
  id: number;
  name: string;
};

type StringParam = BaseParam & {
  type: "string";
};
type NumberParam = BaseParam & {
  type: "number";
  min?: number;
  max?: number;
};
type SelectParam = BaseParam & {
  type: "select";
  options: string[];
};
type Param = StringParam | NumberParam | SelectParam;

type ParamValue = {
  paramId: number;
  value: string;
};

type Color = {
  id: number;
  name: string;
  hex: string;
};

type Model = {
  paramValues: ParamValue[];
  colors: Color[];
};

type Props = {
  params: Param[];
  model: Model;
  renderers?: Record<string, FC<RendererProps>>;
};

type Action =
  | { type: "CHANGE"; paramId: number; value: string }
  | { type: "RESET"; initial: ParamValue[] };

type State = ParamValue[];
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "CHANGE":
      return state.map((pv) =>
        pv.paramId === action.paramId ? { ...pv, value: action.value } : pv
      );
    case "RESET":
      return [...action.initial];
  }
}

type Theme = "light" | "dark";
const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });

export function ThemeProvider({
  children,
}: PropsWithChildren<{ children: ReactNode }>) {
  const [theme, setTheme] = useState<Theme>("light");
  const toggle = useCallback(
    () => setTheme((t) => (t === "light" ? "dark" : "light")),
    []
  );
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export type RendererProps = {
  param: Param;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const StringParamEditor: FC<RendererProps> = memo(
  ({ param, value, onChange, error }) => {
    const id = `param-${param.id}`;
    return (
      <div style={{ marginBottom: 16 }}>
        <label htmlFor={id} style={{ display: "block", marginBottom: 4 }}>
          {param.name}
        </label>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />
        {error && (
          <div id={`${id}-error`} style={{ color: "red", marginTop: 4 }}>
            {error}
          </div>
        )}
      </div>
    );
  }
);

const NumberParamEditor: FC<RendererProps> = memo(
  ({ param, value, onChange, error }) => {
    const id = `param-${param.id}`;
    const numParam = param as NumberParam;
    return (
      <div style={{ marginBottom: 16 }}>
        <label htmlFor={id} style={{ display: "block", marginBottom: 4 }}>
          {param.name}
        </label>
        <input
          id={id}
          type="number"
          value={value}
          min={numParam.min}
          max={numParam.max}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />
        {error && (
          <div id={`${id}-error`} style={{ color: "red", marginTop: 4 }}>
            {error}
          </div>
        )}
      </div>
    );
  }
);

const SelectParamEditor: FC<RendererProps> = memo(
  ({ param, value, onChange, error }) => {
    const id = `param-${param.id}`;
    const selParam = param as SelectParam;
    return (
      <div style={{ marginBottom: 16 }}>
        <label htmlFor={id} style={{ display: "block", marginBottom: 4 }}>
          {param.name}
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        >
          <option value="">— select —</option>
          {selParam.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && (
          <div id={`${id}-error`} style={{ color: "red", marginTop: 4 }}>
            {error}
          </div>
        )}
      </div>
    );
  }
);

const defaultRenderers: Record<string, FC<RendererProps>> = {
  string: StringParamEditor,
  number: NumberParamEditor,
  select: SelectParamEditor,
};

export type ParamEditorHandle = {
  getModel: () => Model;
  reset: () => void;
};

const ParamEditorInner = (
  { params, model, renderers }: Props,
  ref: Ref<ParamEditorHandle>
) => {
  const initialValues = params.map((param) => {
    const found = model.paramValues.find((pv) => pv.paramId === param.id);
    return { paramId: param.id, value: found ? found.value : "" };
  });

  const [values, dispatch] = useReducer(reducer, initialValues);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useImperativeHandle(
    ref,
    () => ({
      getModel: () => ({ paramValues: values, colors: model.colors }),
      reset: () => dispatch({ type: "RESET", initial: initialValues }),
    }),
    [values, model.colors]
  );

  const { theme } = useContext(ThemeContext);

  const validate = useCallback(() => {
    const errs: Record<number, string> = {};
    values.forEach((pv) => {
      if (!pv.value) errs[pv.paramId] = "Required field";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [values]);

  const handleChange = useCallback((paramId: number, value: string) => {
    dispatch({ type: "CHANGE", paramId, value });
    setErrors((e) => {
      const copy = { ...e };
      delete copy[paramId];
      return copy;
    });
  }, []);

  const useRenders = renderers
    ? { ...defaultRenderers, ...renderers }
    : defaultRenderers;

  return (
    <div
      data-theme={theme}
      style={{ padding: 20, background: theme === "dark" ? "#333" : "#fff" }}
    >
      {params.map((param) => {
        const Renderer = useRenders[param.type];
        const current = values.find((v) => v.paramId === param.id);
        return (
          <Renderer
            key={param.id}
            param={param}
            value={current?.value || ""}
            error={errors[param.id]}
            onChange={(v) => handleChange(param.id, v)}
          />
        );
      })}
      <button
        onClick={() => {
          if (validate()) console.log("Valid model:", values);
        }}
        style={{ marginRight: 8 }}
      >
        Validate & Log
      </button>
      <button
        onClick={() => dispatch({ type: "RESET", initial: initialValues })}
      >
        Reset
      </button>
    </div>
  );
};

export const ParamEditor = forwardRef(ParamEditorInner);
