import { Link } from 'react-router-dom';
import { Empty } from '../components/States.jsx';

export default function NotFound() {
  return (
    <div className="container page">
      <Empty title="We could not find this page." action={<Link to="/" className="btn btn-secondary">Go to the start</Link>}>
        The link may be mistyped or out of date.
      </Empty>
    </div>
  );
}
