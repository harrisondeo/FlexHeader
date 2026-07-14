import browser from "webextension-polyfill";
import Button from "../button";
import "./index.css";

interface AppHeaderProps {
  onAddPage: () => void;
}

const AppHeader = ({ onAddPage }: AppHeaderProps) => {
  const manifest = browser.runtime.getManifest();

  return (
    <div className="app-header">
      <div className="app-header__logo">
        <img
          src="logo128.png"
          alt="FlexHeaders Logo"
          width={50}
          height={50}
        />
        <div>
          <p>Flex Headers</p>
          <div>
            <a
              href={`https://github.com/harrisondeo/FlexHeader/releases/tag/v${manifest?.version}`}
              target="_blank"
              rel="noreferrer"
            >
              v{manifest?.version}
            </a>
            {` - `}
            <a
              href={`https://github.com/harrisondeo/FlexHeader/issues`}
              target="_blank"
              rel="noreferrer"
            >
              Feature Requests
            </a>
          </div>
          <div>
            A passion project by{" "}
            <a
              href="https://harrisondeo.me.uk"
              target="_blank"
              rel="noreferrer"
            >
              Harrison Deo
            </a>
          </div>
        </div>
      </div>
      <Button content="New Page" onClick={onAddPage} testId="new-page" />
      {/* <span onClick={clear}>Clear Settings</span> */}
    </div>
  );
};

export default AppHeader;
