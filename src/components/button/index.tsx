import "./index.css";

export interface ButtonProps {
  text: string;
  onClick?: () => void;
}

const Button = ({ text = "", onClick }: ButtonProps) => {
  return (
    <div className="button" onClick={onClick}>
      {text}
    </div>
  );
};

export default Button;
