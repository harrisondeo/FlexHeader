import Button from "../button";
import "./index.css";

const ErrorBoundaryFallback = ({
  error,
  resetErrorBoundary,
}: {
  error: any;
  resetErrorBoundary: () => void;
}) => {
  return (
    <div className="error-boundary_container" role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>
      <br />
      <Button onClick={resetErrorBoundary} size="medium" content="Try again" />
    </div>
  );
};

export default ErrorBoundaryFallback;
