import "./index.css";

export interface ButtonProps {
  text: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
}

const Button = ({ text = "", size = "medium", onClick }: ButtonProps) => {
  return (
    <div className={`button ${size}`} onClick={onClick}>
      {text}
    </div>
  );
};

export default Button;
