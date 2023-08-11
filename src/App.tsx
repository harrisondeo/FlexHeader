import "./App.css";
import Divider from "./components/divider";
import Button from "./components/button";
import HeaderRow from "./components/headerRow";
import useFlexHeaderSettings from "./utils/settings";

function App() {
  const { settings, updateSettings } = useFlexHeaderSettings();

  const addRow = async () => {
    console.log("addRow");
    const newSettings = [...settings];
    newSettings.push({
      headerName: "",
      headerValue: "",
      headerEnabled: false,
    });
    await updateSettings(newSettings);
  };

  const removeRow = async (index: number) => {
    const newSettings = [...settings];
    newSettings.splice(index, 1);
    await updateSettings(newSettings);
  };

  const updateRow = async (
    index: number,
    headerName: string,
    headerValue: string,
    headerEnabled: boolean
  ) => {
    const newSettings = [...settings];
    newSettings[index] = {
      headerName,
      headerValue,
      headerEnabled,
    };
    await updateSettings(newSettings);
  };

  return (
    <div className="app">
      <div className="app__container">
        <div className="app__header">
          <p>Flex Header</p>
        </div>
        <Divider />
        <div className="app__body">
          {settings.map(({ headerName, headerValue, headerEnabled }, i) => (
            <HeaderRow
              key={`header-row__${i}`}
              headerName={headerName}
              headerValue={headerValue}
              headerEnabled={headerEnabled}
              onRemove={() => removeRow(i)}
              onUpdate={(name: string, value: string, enabled: boolean) =>
                updateRow(i, name, value, enabled)
              }
            />
          ))}
        </div>
        <Divider />
        <Button text="Add Row" onClick={addRow} />
        <div>{JSON.stringify(settings)}</div>
      </div>
    </div>
  );
}

export default App;
