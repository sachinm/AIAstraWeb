import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import '../i18n';

// findBy and waitFor give up after 1 s by default, which a busy machine can outrun with a correct page
configure({ asyncUtilTimeout: 10_000 });
