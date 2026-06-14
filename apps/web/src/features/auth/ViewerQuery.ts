import { graphql } from 'react-relay';

/**
 * Identity query for the BFF-resolved `viewer`. Returns null when logged out —
 * that null is how the client distinguishes authenticated from anonymous, so it
 * replaces the old REST `/api/auth/session` identity check. Provider discovery
 * (which must work pre-auth) stays on `/api/auth/providers`.
 */
export const viewerQuery = graphql`
  query ViewerQuery {
    viewer {
      id
      username
      providerId
      avatarUrl
      email
    }
  }
`;
