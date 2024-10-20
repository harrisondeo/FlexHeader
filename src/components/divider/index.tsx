import "./index.css";

const Divider = ({
  thin = false,
  vertical = false,
}: {
  thin?: boolean;
  vertical?: boolean;
}) => {
  return (
    <div
      className={`divider ${vertical ? "vertical" : "horizontal"} ${
        thin ? "thin" : ""
      }`}
    ></div>
  );
};

export default Divider;
