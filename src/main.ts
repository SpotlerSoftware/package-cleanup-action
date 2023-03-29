import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {restEndpointMethods} from '@octokit/plugin-rest-endpoint-methods'

async function run(): Promise<void> {
  try {
    const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods)
    const octokit = new MyOctokit({auth: core.getInput('githubToken')})
    const packageOwner: string = core.getInput('packageOwner')
    const packageName: string = core.getInput('packageName')
    const maxAgeDays = Number(core.getInput('maxAgeDays'))
    const dryRun = core.getInput('dryRun').toLowerCase() === 'true'
    const deleteVersionRegex = new RegExp(core.getInput('deleteVersionRegex'))
    const packageType: typeof octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg.prototype.package_type =
      core.getInput('packageType')

    core.debug(`packageOwner: ${packageOwner}`)
    core.debug(`packageName: ${packageName}`)
    core.debug(`packageType: ${packageType}`)

    core.info(`Matching regex ${deleteVersionRegex.toString()}`)
    if (dryRun) {
      core.info(`Running in dryRun mode not deleting any packages`)
    }

    const packages = await octokit.paginate(
      octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg,
      {
        org: packageOwner,
        package_type: packageType,
        package_name: packageName
      },
      response => {
        return response.data
          .filter(v => {
            const matched = deleteVersionRegex.test(v.name)
            if (!matched) {
              core.info(`Version not matched by regex ${v.name}`)
            }
            return matched
          })
          .filter(v => {
            const difference = Math.abs(
              new Date(v.created_at).getTime() - new Date().getTime()
            )
            const daysOld = Math.ceil(difference / (1000 * 3600 * 24))
            const matched = daysOld > maxAgeDays
            if (!matched) {
              core.info(`Version not matched by age ${v.name}`)
            }
            return matched
          })
          .map(v => {
            core.info(`Matched version ${v.name}`)
            if (!dryRun) {
              octokit.rest.packages.deletePackageVersionForOrg({
                org: packageOwner,
                package_type: packageType,
                package_name: packageName,
                package_version_id: v.id
              })
            }
            return v.name
          })
      }
    )
    if (!packages.length) {
      core.info(`No versions matched`)
    } else {
      core.info(`Versions deleted ${packages.join(',')}`)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
