import { useNavigate } from "react-router";
import { ExeaonCloudLogin } from "#/components/features/backends/exeaon-cloud-login";

/**
 * Full-page in-app sign in / sign up for Exeaon Cloud. On success the cloud
 * backend is stored and made active, then we return to the home screen.
 */
export default function SignInRoute() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-8">
      <ExeaonCloudLogin
        onSignedIn={() => {
          navigate("/");
        }}
      />
    </div>
  );
}
