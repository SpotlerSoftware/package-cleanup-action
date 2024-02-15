import * as core from '@actions/core';
import { Octokit } from '@octokit/core';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { components } from '@octokit/openapi-types';
async function run(): Promise<void> {
  try {
    const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods);
    const octokit = new MyOctokit({ auth: core.getInput('githubToken') });
    const packageOwner: string = core.getInput('packageOwner');
    const packageName: string = core.getInput('packageName');
    const maxAgeDays = Number(core.getInput('maxAgeDays'));
    const dryRun = core.getInput('dryRun').toLowerCase() === 'true';
    const deleteVersionRegex = new RegExp(core.getInput('deleteVersionRegex'));
    const packageType: typeof octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg.prototype.package_type =
      core.getInput('packageType');

    core.debug(`packageOwner: ${packageOwner}`);
    core.debug(`packageName: ${packageName}`);
    core.debug(`packageType: ${packageType}`);

    core.info(`Matching regex ${deleteVersionRegex.toString()}`);
    if (dryRun) {
      core.info(`Running in dryRun mode not deleting any packages`);
    }
    const deleted: Array<string> = [];
    const packages = await octokit.paginate(
      octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg,
      {
        org: packageOwner,
        package_type: packageType,
        package_name: packageName,
      }
    );
    const matchedPackages = packages
      .filter((v) => {
        if (isUntaggedContainer(v)) {
          core.info(`Untagged container ${v.name} will be deleted`);
          return true;
        }
        const name = getVersionName(v);
        const matched = deleteVersionRegex.test(name);
        if (!matched) {
          core.info(`Version not matched by regex ${name}`);
        }
        return matched;
      })
      .filter((v) => {
        const difference = Math.abs(
          new Date(v.created_at).getTime() - new Date().getTime()
        );
        const daysOld = Math.ceil(difference / (1000 * 3600 * 24));
        const matched = daysOld > maxAgeDays;
        if (!matched) {
          core.info(`Version not matched by age ${v.name}`);
        }
        return matched;
      });

    matchedPackages.forEach((v) => {
      core.info(`Matched version ${v.name}`);
      try {
        if (!dryRun) {
          octokit.rest.packages.deletePackageVersionForOrg({
            org: packageOwner,
            package_type: packageType,
            package_name: packageName,
            package_version_id: v.id,
          });
        }
        deleted.push(v.name);
      } catch (error) {
        core.warning(`Failed to delete version ${v.name}`);
      }
    });

    if (!deleted.length) {
      core.info(`No versions matched`);
    } else {
      core.info(`Versions deleted ${deleted.join(',')}`);
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

function getVersionName(
  packageVersion: components['schemas']['package-version']
) {
  return packageVersion.metadata?.container &&
    packageVersion.metadata.container?.tags?.length > 0
    ? packageVersion.metadata.container.tags[0]
    : packageVersion.name;
}

function isUntaggedContainer(
  packageVersion: components['schemas']['package-version']
) {
  return (
    packageVersion.metadata?.container &&
    packageVersion.metadata.container.tags.length === 0
  );
}

run();
