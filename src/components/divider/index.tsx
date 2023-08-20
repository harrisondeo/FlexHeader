import "./index.css";

const Divider = ({ thin = false }: { thin?: boolean }) => {
  return <div className={`divider ${thin ? "thin" : ""}`}></div>;
};

export default Divider;
