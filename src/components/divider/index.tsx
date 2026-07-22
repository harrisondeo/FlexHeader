import "./index.css";
import { cx } from "../../utils/cx";

const Divider = ({
  thin = false,
  vertical = false,
}: {
  thin?: boolean;
  vertical?: boolean;
}) => {
  return (
    <div
      className={cx(
        "divider",
        vertical ? "vertical" : "horizontal",
        { thin }
      )}
    ></div>
  );
};

export default Divider;
